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
  EditableJsonArrayField,
  EditableRelationshipField,
  EditableMultiRelationshipField,
} from '../common';
import { languoidsAPI, Languoid, LANGUOID_LEVEL_CHOICES, LANGUOID_LEVEL_GLOTTOLOG_CHOICES, LanguoidTreeNode } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasDeleteAccess } from '../../utils/permissions';
import DescendantsTree from './DescendantsTree';

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

  // Level change warning state
  const [showLevelChangeWarning, setShowLevelChangeWarning] = useState(false);
  const [pendingLevelChange, setPendingLevelChange] = useState<string | null>(null);
  const [fieldsToLose, setFieldsToLose] = useState<Array<{ fieldName: string; value: any }>>([]);

  // Level detection - based on level_glottolog
  const isFamily = languoid?.level_glottolog === 'family';
  const isLanguage = languoid?.level_glottolog === 'language';
  const isDialect = languoid?.level_glottolog === 'dialect';

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

  // Descendants tree state
  const [descendantsTree, setDescendantsTree] = useState<LanguoidTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

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
        // Pass id directly - backend handles both glottocode and numeric ID
        const data = await languoidsAPI.get(id);
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

  // Load descendants tree asynchronously
  useEffect(() => {
    const loadDescendantsTree = async () => {
      if (!languoid) return;

      try {
        setTreeLoading(true);
        setTreeError(null);
        const tree = await languoidsAPI.getDescendantsTree(languoid.id);
        setDescendantsTree(tree);
      } catch (err) {
        console.error('Error loading descendants tree:', err);
        setTreeError('Failed to load descendants tree.');
      } finally {
        setTreeLoading(false);
      }
    };

    loadDescendantsTree();
  }, [languoid]);

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

    // Special handling for level_glottolog changes - show confirmation dialog
    if (fieldName === 'level_glottolog' && finalValue !== languoid.level_glottolog) {
      // Only show warning if moving away from "language" level
      if (languoid.level_glottolog === 'language' && finalValue !== 'language') {
        // Check if any language-specific fields have data
        const languageSpecificFields = [
          { fieldName: 'Region', value: languoid.region },
          { fieldName: 'Longitude', value: languoid.longitude },
          { fieldName: 'Latitude', value: languoid.latitude },
          { fieldName: 'Tribes', value: languoid.tribes },
          { fieldName: 'Notes', value: languoid.notes }
        ];

        // Add dialects (descendants) if they exist
        if (descendantsTree.length > 0) {
          // Format dialects as "name (glottocode)"
          const dialectsList = descendantsTree
            .map(node => `${node.name} (${node.glottocode})`)
            .join(', ');
          languageSpecificFields.push({
            fieldName: 'Dialects',
            value: dialectsList
          });
        }

        // Filter to only fields that have non-empty values
        const fieldsWithData = languageSpecificFields.filter(field => {
          const value = field.value;
          // Check if value is not null, not undefined, not empty string, and not empty array
          return value !== null && 
                 value !== undefined && 
                 value !== '' && 
                 !(Array.isArray(value) && value.length === 0);
        });

        // Only show warning if there are fields with data that will be lost
        if (fieldsWithData.length > 0) {
          setFieldsToLose(fieldsWithData);
          setPendingLevelChange(finalValue);
          setShowLevelChangeWarning(true);
          return; // Don't proceed with save yet
        }
      }
      
      // If no warning needed, proceed with save
      setPendingLevelChange(finalValue);
    }

    setSavingFields(prev => new Set(prev).add(fieldName));

    try {
      const updateData = { [fieldName]: finalValue };
      const updatedLanguoid = await languoidsAPI.patch(languoid.id, updateData);
      setLanguoid(updatedLanguoid);
      
      // If glottocode was changed, update the URL
      if (fieldName === 'glottocode' && finalValue && finalValue !== languoid.glottocode) {
        // Use replace: true so back button doesn't go to old URL
        navigate(`/languoids/${finalValue}`, { replace: true });
      }
      
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

  // Handle level change confirmation
  const handleLevelChangeConfirm = async () => {
    if (!languoid || !pendingLevelChange) return;

    setSavingFields(prev => new Set(prev).add('level_glottolog'));

    try {
      const updateData = { level_glottolog: pendingLevelChange };
      const updatedLanguoid = await languoidsAPI.patch(languoid.id, updateData);
      setLanguoid(updatedLanguoid);
      
      // Clear editing state
      cancelEditing('level_glottolog');
      setShowLevelChangeWarning(false);
      setPendingLevelChange(null);
      setFieldsToLose([]);
    } catch (error) {
      console.error('Error updating level_glottolog:', error);
      setError('Failed to update level. Please try again.');
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete('level_glottolog');
        return newSet;
      });
    }
  };

  // Handle level change cancellation
  const handleLevelChangeCancel = () => {
    // Revert the edit value back to the original
    if (languoid) {
      setEditValues(prev => ({ ...prev, level_glottolog: languoid.level_glottolog }));
    }
    setShowLevelChangeWarning(false);
    setPendingLevelChange(null);
    setFieldsToLose([]);
    // Don't cancel editing - let the user continue editing or manually cancel
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

  // =============================================================================
  // CARD RENDER HELPER FUNCTIONS
  // =============================================================================

  const renderBasicInfoCard = () => {
    if (!languoid) return null;
    
    return (
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
            fieldName="name_abbrev"
            label="Name Abbreviation"
            value={languoid.name_abbrev || ''}
            isEditing={editingFields.has('name_abbrev')}
            isSaving={savingFields.has('name_abbrev')}
            editValue={editValues.name_abbrev}
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
            fieldName="level_glottolog"
            label="Level"
            value={languoid.level_glottolog || ''}
            options={LANGUOID_LEVEL_GLOTTOLOG_CHOICES}
            isEditing={editingFields.has('level_glottolog')}
            isSaving={savingFields.has('level_glottolog')}
            editValue={editValues.level_glottolog}
            startEditing={startEditing}
            saveField={saveField}
            cancelEditing={cancelEditing}
            updateEditValue={updateEditValue}
          />

          <EditableJsonArrayField
            fieldName="alt_names"
            label="Alternate Names"
            value={languoid.alt_names || []}
            isEditing={editingFields.has('alt_names')}
            isSaving={savingFields.has('alt_names')}
            editValue={editValues.alt_names}
            startEditing={startEditing}
            saveField={saveField}
            cancelEditing={cancelEditing}
            updateEditValue={updateEditValue}
            placeholder="Add alternate name..."
          />
        </Stack>
      </CardContent>
    </Card>
  );
  };

  const renderHierarchyCard = (readOnly: boolean = false) => {
    if (!languoid) return null;
    
    return (
      <Card sx={{ elevation: 1 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
            Hierarchy
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Stack spacing={3}>
            {/* Read-only display fields - computed from hierarchy */}
            <Box sx={{ width: '100%', mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                Family:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {languoid.family_name 
                  ? `${languoid.family_name}${languoid.family_glottocode ? ` (${languoid.family_glottocode})` : ''}`
                  : '(none)'}
              </Typography>
            </Box>

            <Box sx={{ width: '100%', mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                Primary Subgroup:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {languoid.pri_subgroup_name 
                  ? `${languoid.pri_subgroup_name}${languoid.pri_subgroup_glottocode ? ` (${languoid.pri_subgroup_glottocode})` : ''}`
                  : '(none)'}
              </Typography>
            </Box>

            <Box sx={{ width: '100%', mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                Secondary Subgroup:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {languoid.sec_subgroup_name 
                  ? `${languoid.sec_subgroup_name}${languoid.sec_subgroup_glottocode ? ` (${languoid.sec_subgroup_glottocode})` : ''}`
                  : '(none)'}
              </Typography>
            </Box>

            {/* Parent Languoid - editable field */}
            <EditableRelationshipField
            fieldName="parent_languoid"
            label="Parent Languoid"
            value={languoid.parent_languoid ? {
              id: languoid.parent_languoid,
              name: languoid.parent_name || '',
              glottocode: languoid.parent_glottocode || '',
              display_name: languoid.parent_name || `ID: ${languoid.parent_languoid}`
            } : null}
            isEditing={editingFields.has('parent_languoid')}
            isSaving={savingFields.has('parent_languoid')}
            editValue={editValues.parent_languoid}
            startEditing={startEditing}
            saveField={saveField}
            cancelEditing={cancelEditing}
            updateEditValue={updateEditValue}
            relationshipEndpoint="/internal/v1/languoids/"
            getOptionLabel={(option) => `${option.name}${option.glottocode ? ` (${option.glottocode})` : ''}`}
            readOnly={readOnly}
            filterParams={
              languoid.level_glottolog === 'dialect'
                ? { level_glottolog: 'language' }
                : { level_glottolog: 'family' }
            }
          />
        </Stack>
      </CardContent>
    </Card>
  );
  };

  const renderDescendantsCard = (config: {
    title: string;
    editable: boolean;
    filterLevel?: string;
  }) => {
    if (!languoid) return null;
    
    // Build filter parameters if a filter level is specified
    const filterParams = config.filterLevel ? { level_nal: config.filterLevel } : undefined;
    
    return (
      <Card sx={{ elevation: 1 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
            Descendants
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          {/* Hierarchical tree view - read-only */}
          <DescendantsTree 
            nodes={descendantsTree}
            loading={treeLoading}
            error={treeError}
          />
          
          {/* Editable field - only shown if editable is true */}
          {config.editable && (
            <>
              {/* Divider between tree and editable field */}
              {descendantsTree.length > 0 && <Divider sx={{ my: 2 }} />}
              
              <Stack spacing={3}>
                <EditableMultiRelationshipField
                  fieldName="descendents"
                  label={config.title}
                  value={languoid.descendents || []}
                  isEditing={editingFields.has('descendents')}
                  isSaving={savingFields.has('descendents')}
                  editValue={editValues.descendents}
                  startEditing={startEditing}
                  saveField={saveField}
                  cancelEditing={cancelEditing}
                  updateEditValue={updateEditValue}
                  relationshipEndpoint="/internal/v1/languoids/"
                  getOptionLabel={(option) => `${option.name}${option.glottocode ? ` (${option.glottocode})` : ''}`}
                  readOnly={!config.editable}
                  filterParams={filterParams}
                />
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderAdditionalInfoCard = () => {
    if (!languoid) return null;
    
    return (
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
  );
  };

  const renderLocationCard = () => {
    if (!languoid) return null;
    
    return (
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
  );
  };

  // =============================================================================
  // LEVEL-SPECIFIC LAYOUT FUNCTIONS
  // =============================================================================

  const renderFamilyLayout = () => {
    if (!languoid) return null;
    
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
      {/* Left Column */}
      <Stack spacing={3}>
        {renderBasicInfoCard()}
        {renderHierarchyCard(false)}
        {renderDescendantsCard({ title: 'Languages', editable: false, filterLevel: 'language' })}
      </Stack>

      {/* Right Column */}
      <Stack spacing={3}>
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
  );
  };

  const renderLanguageLayout = () => {
    if (!languoid) return null;
    
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
      {/* Left Column */}
      <Stack spacing={3}>
        {renderBasicInfoCard()}
        {renderHierarchyCard(false)}
        {renderDescendantsCard({ title: 'Dialects', editable: true, filterLevel: 'dialect' })}
        {renderAdditionalInfoCard()}
      </Stack>

      {/* Right Column */}
      <Stack spacing={3}>
        {renderLocationCard()}

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
  );
  };

  const renderDialectLayout = () => {
    if (!languoid) return null;
    
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
      {/* Left Column */}
      <Stack spacing={3}>
        {renderBasicInfoCard()}
        {renderHierarchyCard(false)}
      </Stack>

      {/* Right Column */}
      <Stack spacing={3}>
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
  );
  };

  // =============================================================================
  // EARLY RETURNS
  // =============================================================================

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
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="h1">
            {languoid.name}
          </Typography>
          {languoid.name_abbrev && languoid.name_abbrev !== languoid.name && (
            <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
              ({languoid.name_abbrev})
            </Typography>
          )}
        </Box>
        <Chip
          label={languoid.level_display}
          color={
            languoid.level_nal === 'family' ? 'primary' :
            languoid.level_nal === 'language' ? 'success' : 'warning'
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
            {isFamily && (
              <>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Children</Typography>
                  <Typography variant="body1">{languoid.child_count}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Descendants</Typography>
                  <Typography variant="body1">{languoid.descendents?.length || 0}</Typography>
                </Box>
              </>
            )}
            {isLanguage && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Dialects</Typography>
                <Typography variant="body1">{languoid.dialect_count}</Typography>
              </Box>
            )}
            {isDialect && languoid.parent_name && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Language</Typography>
                <Typography variant="body1">
                  {languoid.parent_name}
                  {languoid.parent_glottocode && ` (${languoid.parent_glottocode})`}
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Level-specific layouts */}
      {isFamily && renderFamilyLayout()}
      {isLanguage && renderLanguageLayout()}
      {isDialect && renderDialectLayout()}

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

      {/* Level Change Warning Dialog */}
      <Dialog 
        open={showLevelChangeWarning} 
        onClose={handleLevelChangeCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Level Change</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
              Changing from Language to {pendingLevelChange === 'family' ? 'Family' : 'Dialect'} will result in loss of the following language-specific data:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
              {fieldsToLose.map((field, index) => (
                <li key={index}>
                  <Typography variant="body2" component="span">
                    <strong>{field.fieldName}:</strong> {String(field.value)}
                  </Typography>
                </li>
              ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Are you sure you want to continue?
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLevelChangeCancel}>Cancel</Button>
          <Button
            onClick={handleLevelChangeConfirm}
            color="warning"
            variant="contained"
            disabled={savingFields.has('level_glottolog')}
          >
            {savingFields.has('level_glottolog') ? 'Saving...' : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>

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
