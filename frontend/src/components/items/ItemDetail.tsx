import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import {
  Typography,
  Box,
  Chip,
  Stack,
  Button,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  TextField,
  Tooltip,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { itemsAPI, type Item } from '../../services/api';
import { 
  DateInterpretationFeedback,
  EditableTextField,
  EditableSelectField,
  EditableBooleanField,
  EditableMultiRelationshipField,
  SelectOption,
  createAbbreviatedLabel
} from '../common';
import { EditableTitlesList } from './EditableTitlesList';
import { useAuth } from '../../contexts/AuthContext';
import { hasDeleteAccess } from '../../utils/permissions';

const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8000/internal/v1'
  : '/internal/v1';

// Date format help component
const DateFormatHelp: React.FC = () => (
  <Box sx={{ mt: 1, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
    <Typography variant="caption" sx={{ fontWeight: 'medium', display: 'block', mb: 1 }}>
      📅 Accepted Date Formats (preferred format shown first):
    </Typography>
    <Typography variant="caption" component="div" sx={{ lineHeight: 1.3 }}>
      <strong>Years:</strong> 2023, 1990s, 1990s?, 2020-2025<br/>
      <strong>Months:</strong> 2023/03, March 2023, 3/2023<br/>
      <strong>Full Dates:</strong> 2023/03/15, 3/15/2023<br/>
      <strong>Date Ranges:</strong> 2020/03-2023/10, 1/2020-3/2021, 2020-2023<br/>
      <strong>Approximate:</strong> ca 2023, 19th century, early 2020s<br/>
      <strong>Partial/Uncertain:</strong> 2023?, Spring 2023, circa 1950
    </Typography>
  </Box>
);

// Choice field options to match Django model choices
const ACCESS_LEVEL_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 - Open Access' },
  { value: '2', label: '2 - Materials are available to view onsite but no copies may be distributed' },
  { value: '3', label: '3 - Access protected by a time limit' },
  { value: '4', label: '4 - Depositor (or someone else) controls access to the resource' },
  { value: '', label: 'Not specified' }
];

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { value: '3d_object', label: '3D Object' },
  { value: 'audio', label: 'Audio' },
  { value: 'audio-video', label: 'Audio/Video' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'ephemera', label: 'Ephemera' },
  { value: 'image', label: 'Image (Photograph)' },
  { value: 'manuscript', label: 'Manuscript' },
  { value: 'multimedia', label: 'Multimedia' },
  { value: 'other', label: 'Other' },
  { value: 'publication_article', label: 'Publication: Journal Article' },
  { value: 'publication_book', label: 'Publication: Book' },
  { value: 'publication_chapter', label: 'Publication: Book chapter' },
  { value: 'publication_other', label: 'Publication (other)' },
  { value: 'publication_thesis', label: 'Publication: Thesis' },
  { value: 'website', label: 'Website' },
  { value: '', label: 'Not specified' }
];

const AVAILABILITY_STATUS_OPTIONS: SelectOption[] = [
  { value: 'available', label: 'Available' },
  { value: 'restrictions', label: 'Restrictions apply' },
  { value: 'missing_parts', label: 'Missing parts' },
  { value: 'missing', label: 'Missing' },
  { value: '', label: 'Not specified' }
];

const CONDITION_OPTIONS: SelectOption[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: '', label: 'Not specified' }
];

const ACCESSION_TYPE_OPTIONS: SelectOption[] = [
  { value: 'conversion', label: 'Conversion' },
  { value: 'transfer', label: 'Exchange/Transfer' },
  { value: 'field', label: 'Field Collection' },
  { value: 'found', label: 'Found in Collection/Conversion' },
  { value: 'gift', label: 'Gift' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'reproduction', label: 'Reproduction' },
  { value: '', label: 'Not specified' }
];

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'audio_cd', label: 'audio CD' },
  { value: 'audio_reel', label: 'audio reel' },
  { value: 'book', label: 'book' },
  { value: 'cassette', label: 'cassette' },
  { value: 'cd', label: 'CD' },
  { value: 'cd_dvd', label: 'CD-DVD' },
  { value: 'dat', label: 'DAT' },
  { value: 'cd_r', label: 'data CD (CD-R)' },
  { value: 'dv_r', label: 'data DVD (DV-R)' },
  { value: 'diskette', label: 'diskette' },
  { value: 'dvd', label: 'DVD' },
  { value: 'ephemera', label: 'ephemera' },
  { value: 'garment', label: 'garment' },
  { value: 'hi_8', label: 'hi-8' },
  { value: 'manuscript', label: 'manuscript' },
  { value: 'microcassette', label: 'microcassette' },
  { value: 'mini_DV', label: 'mini-DV' },
  { value: 'other', label: 'other' },
  { value: 'phonograph_record', label: 'phonograph record' },
  { value: 'reel_to_reel', label: 'reel-to-reel' },
  { value: 'vhs', label: 'VHS' },
  { value: 'video_reel', label: 'video reel' },
  { value: '', label: 'Not specified' }
];

interface ItemDetailProps {
  showActions?: boolean;
  onEdit?: (item: Item) => void;
  onDelete?: (item: Item) => void;
}

interface ItemDetailProps {
  showActions?: boolean;
  onEdit?: (item: Item) => void;
  onDelete?: (item: Item) => void;
}

const ItemDetail: React.FC<ItemDetailProps> = ({
  showActions = true,
  onEdit,
  onDelete,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { state: authState } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // In-place editing state
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  // State for date interpretation feedback - prevents cross-field re-renders
  const [dateInterpretationValues, setDateInterpretationValues] = useState<Record<string, string>>({});

  // Handler for date interpretation feedback
  const handleDateInterpretationChange = (fieldName: string, value: string) => {
    setDateInterpretationValues(prev => ({ ...prev, [fieldName]: value }));
  };

  // Handler for titles changes
  const handleTitlesChange = (updatedTitles: any[]) => {
    if (item) {
      setItem(prev => prev ? { ...prev, titles: updatedTitles } : null);
    }
  };

  // Handler for primary title changes
  const handlePrimaryTitleChange = (newPrimaryTitle: string) => {
    if (item) {
      setItem(prev => prev ? { ...prev, primary_title: newPrimaryTitle } : null);
    }
  };

  useEffect(() => {
    const loadItem = async () => {
      if (!id) {
        setError('No item ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const itemData = await itemsAPI.get(parseInt(id, 10));
        setItem(itemData);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load item';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadItem();
  }, [id]);

  const handleBack = () => {
    navigate('/items');
  };

  const handleDelete = () => {
    if (item && hasDeleteAccess(authState.user)) {
      setShowDeleteConfirmation(true);
      setDeleteConfirmationText('');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!item || deleteConfirmationText !== item.catalog_number) {
      return;
    }

    try {
      await itemsAPI.delete(item.id);
      
      if (onDelete) {
        onDelete(item);
      } else {
        navigate('/items');
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      // TODO: Show error message to user
    } finally {
      setShowDeleteConfirmation(false);
      setDeleteConfirmationText('');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirmation(false);
    setDeleteConfirmationText('');
  };

  // In-place editing handlers
  const startEditing = (fieldName: string, currentValue: string) => {
    setEditingFields(prev => new Set(prev).add(fieldName));
    setEditValues(prev => ({ ...prev, [fieldName]: currentValue || '' }));
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
    
    // Reset catalog number validation when cancelling edit
    if (fieldName === 'catalog_number') {
      setCatalogNumberValidation({
        isValidating: false,
        error: null,
        isValid: true
      });
    }
  };

  const saveField = async (fieldName: string, customValue?: any) => {
    if (!item) return;
    
    // Use custom value if provided, otherwise use editValues
    const valueToSave = customValue !== undefined ? customValue : editValues[fieldName];
    if (valueToSave === undefined) return;

    try {
      setSavingFields(prev => new Set(prev).add(fieldName));
      
      // Use PATCH to update only the specific field
      const updatedItem = await itemsAPI.patch(item.id, {
        [fieldName]: valueToSave
      });
      
      // Update the item state with the new data
      setItem(updatedItem);
      
      // Clear editing state for this field
      cancelEditing(fieldName);
      
    } catch (err: any) {
      setError(`Failed to update ${fieldName}: ${err.message}`);
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }
  };

  // Validation state for catalog number
  const [catalogNumberValidation, setCatalogNumberValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  // Debounced catalog number validation - use useMemo like working version
  const validateCatalogNumber = useMemo(
    () => debounce(async (value: string, currentCatalogNumber: string) => {
      if (!value.trim()) {
        setCatalogNumberValidation({
          isValidating: false,
          error: 'Catalog number is required',
          isValid: false
        });
        return;
      }

      // Basic format validation
      if (value.length > 255) {
        setCatalogNumberValidation({
          isValidating: false,
          error: 'Catalog number cannot exceed 255 characters',
          isValid: false
        });
        return;
      }

      // Skip validation if it's the same as current value
      if (value === currentCatalogNumber) {
        setCatalogNumberValidation({
          isValidating: false,
          error: null,
          isValid: true
        });
        return;
      }

      setCatalogNumberValidation(prev => ({ ...prev, isValidating: true }));

      try {
        // Check uniqueness via authenticated API
        const response = await itemsAPI.list({ 
          catalog_number: value, 
          page_size: 1 
        });
        
        if (response.results && response.results.length > 0) {
          setCatalogNumberValidation({
            isValidating: false,
            error: `Catalog number "${value}" already exists`,
            isValid: false
          });
        } else {
          setCatalogNumberValidation({
            isValidating: false,
            error: null,
            isValid: true
          });
        }
      } catch (error) {
        console.error('Error validating catalog number:', error);
        setCatalogNumberValidation({
          isValidating: false,
          error: 'Unable to validate uniqueness. Please try again.',
          isValid: false
        });
      }
    }, 500),
    [item] // Depend on item like the working version depends on originalItem
  );

  const updateEditValue = (fieldName: string, value: string) => {
    setEditValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Trigger validation for catalog_number
    if (fieldName === 'catalog_number' && item) {
      validateCatalogNumber(value, item.catalog_number);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <CircularProgress size={40} aria-label="Loading item details" />
        <Typography variant="body1" color="text.secondary">
          Loading item details...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back to Items List
        </Button>
      </Box>
    );
  }

  // No item found
  if (!item) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Item not found
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back to Items List
        </Button>
      </Box>
    );
  }

  const renderField = (label: string, value: string | string[] | null | undefined, isArray = false) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return null;
    }

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
          {label}:
        </Typography>
        {isArray && Array.isArray(value) ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {value.map((item, index) => (
              <Chip key={index} label={item} size="small" />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {Array.isArray(value) ? value.join(', ') : value}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box>
      {/* Header with navigation and actions */}
      <Box sx={{ mb: 3 }}>
        <Stack 
          direction={isMobile ? 'column' : 'row'} 
          justifyContent="space-between" 
          alignItems={isMobile ? 'stretch' : 'center'}
          spacing={2}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={handleBack}
              aria-label="Back to Items List"
              sx={{ minWidth: '44px', minHeight: '44px' }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography 
                variant="h4" 
                component="h1"
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: { xs: '1.5rem', md: '2.125rem' }
                }}
              >
                {item.primary_title || item.catalog_number}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Box>
                  <EditableTextField
                    fieldName="catalog_number"
                    label="Catalog Number"
                    value={item.catalog_number}
                    isEditing={editingFields.has('catalog_number')}
                    isSaving={savingFields.has('catalog_number')}
                    editValue={editValues.catalog_number || ''}
                    startEditing={startEditing}
                    cancelEditing={cancelEditing}
                    saveField={(fieldName) => {
                      // Only allow saving if validation passes
                      if (catalogNumberValidation.isValid && !catalogNumberValidation.isValidating) {
                        saveField(fieldName);
                      }
                    }}
                    updateEditValue={updateEditValue}
                    validationState={catalogNumberValidation}
                  />
                  
                  {/* Validation feedback for catalog number */}
                  {editingFields.has('catalog_number') && (
                    <Box sx={{ mt: 1 }}>
                      {catalogNumberValidation.isValidating && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="caption" color="text.secondary">
                            Checking uniqueness...
                          </Typography>
                        </Box>
                      )}
                      
                      {catalogNumberValidation.error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          {catalogNumberValidation.error}
                        </Alert>
                      )}
                      
                      {!catalogNumberValidation.error && !catalogNumberValidation.isValidating && editValues.catalog_number && (
                        <Alert severity="success" sx={{ mt: 1 }}>
                          Catalog number is available
                        </Alert>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Action buttons removed from header - delete moved to bottom for security */}
        </Stack>

        {/* Status chips */}
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip 
            label={item.resource_type_display || 'Unknown Type'} 
            color="primary"
            size="small"
          />
          <Chip 
            label={item.item_access_level_display || 'Unknown Access'} 
            color={item.item_access_level === '1' ? 'success' : 'default'}
            size="small"
          />
          {item.genre_display && item.genre_display.length > 0 && (
            item.genre_display.slice(0, 3).map((genre, index) => (
              <Chip key={index} label={genre} variant="outlined" size="small" />
            ))
          )}
          {item.genre_display && item.genre_display.length > 3 && (
            <Chip 
              label={`+${item.genre_display.length - 3} more`} 
              variant="outlined" 
              size="small" 
              color="secondary"
            />
          )}
        </Stack>
      </Box>

      {/* Main content */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3 
      }}>
        {/* Left column - Primary information */}
        <Box sx={{ flex: { xs: 1, md: 2 } }}>
          {/* Titles */}
          {item.titles && item.titles.length > 0 && (
            <Card sx={{ mb: 2 }} elevation={1}>
              <CardContent>
                <EditableTitlesList
                  itemId={Number(id)}
                  titles={item.titles}
                  onTitlesChange={handleTitlesChange}
                  onPrimaryTitleChange={handlePrimaryTitleChange}
                />
              </CardContent>
            </Card>
          )}

           {/* Description */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Description
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <EditableTextField
                 fieldName="description"
                 label="Description Scope and Content"
                 value={item.description || ''}
                 isEditing={editingFields.has('description')}
                 isSaving={savingFields.has('description')}
                 editValue={editValues.description || ''}
                 startEditing={startEditing}
                 cancelEditing={cancelEditing}
                 saveField={saveField}
                 updateEditValue={updateEditValue}
                 multiline={true}
                 rows={4}
               />
               {renderField('Language Description Type', item.language_description_type_display, true)}
               <EditableTextField
                 fieldName="associated_ephemera"
                 label="Associated Ephemera"
                 value={item.associated_ephemera || ''}
                 isEditing={editingFields.has('associated_ephemera')}
                 isSaving={savingFields.has('associated_ephemera')}
                 editValue={editValues.associated_ephemera || ''}
                 startEditing={startEditing}
                 cancelEditing={cancelEditing}
                 saveField={saveField}
                 updateEditValue={updateEditValue}
               />
             </CardContent>
           </Card>

           {/* Languages and Dialects */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Languages and Dialects
               </Typography>
               <Divider sx={{ mb: 2 }} />
               
               <EditableMultiRelationshipField
                 fieldName="language"
                 label="Languages"
                 value={item.language || []}
                 isEditing={editingFields.has('language')}
                 isSaving={savingFields.has('language')}
                 editValue={editValues.language}
                 startEditing={startEditing}
                 saveField={saveField}
                 cancelEditing={cancelEditing}
                 updateEditValue={updateEditValue}
                 relationshipEndpoint="/internal/v1/languoids/"
                 getOptionLabel={(option) => `${option.name}${option.glottocode ? ` (${option.glottocode})` : ''}`}
                 filterParams={{ level_glottolog__in: 'language,dialect' }}
               />
               
               {/* Info message for language field when editing */}
               {editingFields.has('language') && (
                 <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                   You can add both languages and dialects directly. When you add a dialect, its parent language will be automatically added as well.
                 </Alert>
               )}
             </CardContent>
           </Card>

           {/* Collaborators */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Collaborators
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {renderField('Collaborators', item.collaborator_names, true)}
                 {/* TODO: Add collaborator roles and citation author info from through table */}
               </Box>
             </CardContent>
           </Card>

           {/* Files */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Files
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {/* TODO: Implement Files serializer and display file metadata/previews */}
                 <Typography variant="body2" color="text.secondary" fontStyle="italic">
                   File information will be displayed here once the Files serializer is implemented
                 </Typography>
               </Box>
             </CardContent>
           </Card>

           {/* Access & Permissions */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Access & Permissions
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {renderField('Access Level Restrictions', item.access_level_restrictions)}
                 {renderField('Copyrighted Notes', item.copyrighted_notes)}
                 <EditableBooleanField
                   fieldName="permission_to_publish_online"
                   label="Permission to Publish Online"
                   value={item.permission_to_publish_online !== null ? String(item.permission_to_publish_online) : ''}
                   isEditing={editingFields.has('permission_to_publish_online')}
                   isSaving={savingFields.has('permission_to_publish_online')}
                   editValue={editValues.permission_to_publish_online !== undefined ? 
                     String(editValues.permission_to_publish_online) : 
                     (item.permission_to_publish_online !== null ? String(item.permission_to_publish_online) : '')}
                   startEditing={(fieldName, value) => {
                     const boolValue = item.permission_to_publish_online;
                     startEditing(fieldName, boolValue !== null ? String(boolValue) : '');
                   }}
                   cancelEditing={cancelEditing}
                   saveField={(fieldName, value) => {
                     // The EditableBooleanField passes the converted boolean/null value
                     saveField(fieldName, value);
                   }}
                   updateEditValue={updateEditValue}
                 />
               </Box>
             </CardContent>
           </Card>

           {/* Accessions */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Accessions
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 <EditableTextField
                   fieldName="accession_number"
                   label="Accession Number"
                   value={item.accession_number || ''}
                   isEditing={editingFields.has('accession_number')}
                   isSaving={savingFields.has('accession_number')}
                   editValue={editValues.accession_number || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                <EditableTextField
                  fieldName="accession_date"
                  label="Accession Date"
                  value={item.accession_date || ''}
                  isEditing={editingFields.has('accession_date')}
                  isSaving={savingFields.has('accession_date')}
                  editValue={editValues.accession_date !== undefined ? 
                    String(editValues.accession_date) : 
                    (item.accession_date || '')}
                  startEditing={startEditing}
                  cancelEditing={cancelEditing}
                  saveField={saveField}
                  updateEditValue={updateEditValue}
                  onValueChange={(value) => handleDateInterpretationChange('accession_date', value)}
                />
                
                {/* Date interpretation feedback - shows what will happen to input */}
                <DateInterpretationFeedback 
                  value={dateInterpretationValues.accession_date || ''}
                  show={editingFields.has('accession_date')}
                />
                
                {editingFields.has('accession_date') && <DateFormatHelp />}
                 <EditableSelectField
                   fieldName="type_of_accession"
                   label="Type of Accession"
                   value={item.type_of_accession || ''}
                   isEditing={editingFields.has('type_of_accession')}
                   isSaving={savingFields.has('type_of_accession')}
                   editValue={editValues.type_of_accession !== undefined ? 
                     String(editValues.type_of_accession) : 
                     (item.type_of_accession || '')}
                   startEditing={(fieldName, value) => {
                     startEditing(fieldName, item.type_of_accession || '');
                   }}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   options={ACCESSION_TYPE_OPTIONS}
                 />
                 <EditableTextField
                   fieldName="acquisition_notes"
                   label="Acquisition Notes"
                   value={item.acquisition_notes || ''}
                   isEditing={editingFields.has('acquisition_notes')}
                   isSaving={savingFields.has('acquisition_notes')}
                   editValue={editValues.acquisition_notes || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   multiline={true}
                   rows={3}
                 />
                 {renderField('Project/Grant', item.project_grant)}
                 {renderField('Collection', item.collection_name)}
                 <EditableTextField
                   fieldName="collector_name"
                   label="Collector Name"
                   value={item.collector_name || ''}
                   isEditing={editingFields.has('collector_name')}
                   isSaving={savingFields.has('collector_name')}
                   editValue={editValues.collector_name || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 <EditableTextField
                   fieldName="collector_info"
                   label="Collector Info"
                   value={item.collector_info || ''}
                   isEditing={editingFields.has('collector_info')}
                   isSaving={savingFields.has('collector_info')}
                   editValue={editValues.collector_info || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   multiline
                   rows={3}
                 />
                 {renderField('Collector\'s Number', item.collectors_number)}
                <EditableTextField
                  fieldName="collection_date"
                  label="Collection Date"
                  value={item.collection_date || ''}
                  isEditing={editingFields.has('collection_date')}
                  isSaving={savingFields.has('collection_date')}
                  editValue={editValues.collection_date !== undefined ? 
                    String(editValues.collection_date) : 
                    (item.collection_date || '')}
                  startEditing={startEditing}
                  cancelEditing={cancelEditing}
                  saveField={saveField}
                  updateEditValue={updateEditValue}
                  onValueChange={(value) => handleDateInterpretationChange('collection_date', value)}
                />
                
                {/* Date interpretation feedback - shows what will happen to input */}
                <DateInterpretationFeedback 
                  value={dateInterpretationValues.collection_date || ''}
                  show={editingFields.has('collection_date')}
                />
                
                {editingFields.has('collection_date') && <DateFormatHelp />}
                 {renderField('Collecting Notes', item.collecting_notes)}
                 <EditableTextField
                   fieldName="depositor_name"
                   label="Depositor Name"
                   value={item.depositor_name || ''}
                   isEditing={editingFields.has('depositor_name')}
                   isSaving={savingFields.has('depositor_name')}
                   editValue={editValues.depositor_name || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 <EditableTextField
                   fieldName="depositor_contact_information"
                   label="Depositor Contact Information"
                   value={item.depositor_contact_information || ''}
                   isEditing={editingFields.has('depositor_contact_information')}
                   isSaving={savingFields.has('depositor_contact_information')}
                   editValue={editValues.depositor_contact_information || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   multiline
                   rows={3}
                 />
                <EditableTextField
                  fieldName="deposit_date"
                  label="Deposit Date"
                  value={item.deposit_date || ''}
                  isEditing={editingFields.has('deposit_date')}
                  isSaving={savingFields.has('deposit_date')}
                  editValue={editValues.deposit_date !== undefined ? 
                    String(editValues.deposit_date) : 
                    (item.deposit_date || '')}
                  startEditing={startEditing}
                  cancelEditing={cancelEditing}
                  saveField={saveField}
                  updateEditValue={updateEditValue}
                  onValueChange={(value) => handleDateInterpretationChange('deposit_date', value)}
                />
                
                {/* Date interpretation feedback - shows what will happen to input */}
                <DateInterpretationFeedback 
                  value={dateInterpretationValues.deposit_date || ''}
                  show={editingFields.has('deposit_date')}
                />
                
                {editingFields.has('deposit_date') && <DateFormatHelp />}
               </Box>
             </CardContent>
           </Card>

           {/* Digitization */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Digitization
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 <EditableSelectField
                   fieldName="original_format_medium"
                   label="Original Format Medium"
                   value={item.original_format_medium || ''}
                   isEditing={editingFields.has('original_format_medium')}
                   isSaving={savingFields.has('original_format_medium')}
                   editValue={editValues.original_format_medium !== undefined ? 
                     String(editValues.original_format_medium) : 
                     (item.original_format_medium || '')}
                   startEditing={(fieldName, value) => {
                     startEditing(fieldName, item.original_format_medium || '');
                   }}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   options={FORMAT_OPTIONS}
                 />
                 {renderField('Recorded On', item.recorded_on)}
                 {renderField('Equipment Used', item.equipment_used)}
                 {renderField('Software Used', item.software_used)}
                 {renderField('Conservation Recommendation', item.conservation_recommendation)}
                 <EditableTextField
                   fieldName="location_of_original"
                   label="Location of Original"
                   value={item.location_of_original || ''}
                   isEditing={editingFields.has('location_of_original')}
                   isSaving={savingFields.has('location_of_original')}
                   editValue={editValues.location_of_original || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 {renderField('Other Information', item.other_information)}
               </Box>
             </CardContent>
           </Card>

           {/* Books */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Books
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 <EditableTextField
                   fieldName="publisher"
                   label="Publisher"
                   value={item.publisher || ''}
                   isEditing={editingFields.has('publisher')}
                   isSaving={savingFields.has('publisher')}
                   editValue={editValues.publisher || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 <EditableTextField
                   fieldName="publisher_address"
                   label="Publisher Address"
                   value={item.publisher_address || ''}
                   isEditing={editingFields.has('publisher_address')}
                   isSaving={savingFields.has('publisher_address')}
                   editValue={editValues.publisher_address || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   multiline
                   rows={2}
                 />
                 <EditableTextField
                   fieldName="isbn"
                   label="ISBN"
                   value={item.isbn || ''}
                   isEditing={editingFields.has('isbn')}
                   isSaving={savingFields.has('isbn')}
                   editValue={editValues.isbn || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 <EditableTextField
                   fieldName="loc_catalog_number"
                   label="LOC Catalog Number"
                   value={item.loc_catalog_number || ''}
                   isEditing={editingFields.has('loc_catalog_number')}
                   isSaving={savingFields.has('loc_catalog_number')}
                   editValue={editValues.loc_catalog_number || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 <EditableTextField
                   fieldName="total_number_of_pages_and_physical_description"
                   label="Total Number of Pages and Physical Description"
                   value={item.total_number_of_pages_and_physical_description || ''}
                   isEditing={editingFields.has('total_number_of_pages_and_physical_description')}
                   isSaving={savingFields.has('total_number_of_pages_and_physical_description')}
                   editValue={editValues.total_number_of_pages_and_physical_description || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   multiline
                   rows={2}
                 />
               </Box>
             </CardContent>
           </Card>
        </Box>

        {/* Right column - Metadata */}
        <Box sx={{ flex: 1 }}>
           {/* Collection Information */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Collection Information
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {renderField('Collection', item.collection_name)}
               </Box>
             </CardContent>
           </Card>

           {/* Item Details */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Item Details
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 <EditableSelectField
                   fieldName="item_access_level"
                   label="Access Level"
                   value={item.item_access_level || ''}
                   isEditing={editingFields.has('item_access_level')}
                   isSaving={savingFields.has('item_access_level')}
                   editValue={editValues.item_access_level !== undefined ? 
                     String(editValues.item_access_level) : 
                     (item.item_access_level || '')}
                   startEditing={(fieldName, value) => {
                     startEditing(fieldName, item.item_access_level || '');
                   }}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   options={ACCESS_LEVEL_OPTIONS}
                 />
                 <EditableSelectField
                   fieldName="resource_type"
                   label="Resource Type"
                   value={item.resource_type || ''}
                   isEditing={editingFields.has('resource_type')}
                   isSaving={savingFields.has('resource_type')}
                   editValue={editValues.resource_type !== undefined ? 
                     String(editValues.resource_type) : 
                     (item.resource_type || '')}
                   startEditing={(fieldName, value) => {
                     startEditing(fieldName, item.resource_type || '');
                   }}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   options={RESOURCE_TYPE_OPTIONS}
                 />
                 <EditableTextField
                   fieldName="call_number"
                   label="Call Number"
                   value={item.call_number || ''}
                   isEditing={editingFields.has('call_number')}
                   isSaving={savingFields.has('call_number')}
                   editValue={editValues.call_number || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
               </Box>
             </CardContent>
           </Card>

           {/* Dates */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Important Dates
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                <EditableTextField
                  fieldName="creation_date"
                  label="Creation Date"
                  value={item.creation_date || ''}
                  isEditing={editingFields.has('creation_date')}
                  isSaving={savingFields.has('creation_date')}
                  editValue={editValues.creation_date !== undefined ? 
                    String(editValues.creation_date) : 
                    (item.creation_date || '')}
                  startEditing={startEditing}
                  cancelEditing={cancelEditing}
                  saveField={saveField}
                  updateEditValue={updateEditValue}
                  onValueChange={(value) => handleDateInterpretationChange('creation_date', value)}
                />
                
                {/* Date interpretation feedback - shows what will happen to input */}
                <DateInterpretationFeedback 
                  value={dateInterpretationValues.creation_date || ''}
                  show={editingFields.has('creation_date')}
                />
                
                {editingFields.has('creation_date') && <DateFormatHelp />}
               </Box>
             </CardContent>
           </Card>

           {/* Genre */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Genre
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {renderField('Genres', item.genre_display, true)}
               </Box>
             </CardContent>
           </Card>

           {/* Browse Categories */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Browse Categories
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {/* TODO: Implement browse categories functionality */}
                 <Typography variant="body2" color="text.secondary" fontStyle="italic">
                   Browse categories will be displayed here
                 </Typography>
               </Box>
             </CardContent>
           </Card>

           {/* Condition */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Condition
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 <EditableSelectField
                   fieldName="availability_status"
                   label="Availability Status"
                   value={item.availability_status || ''}
                   isEditing={editingFields.has('availability_status')}
                   isSaving={savingFields.has('availability_status')}
                   editValue={editValues.availability_status !== undefined ? 
                     String(editValues.availability_status) : 
                     (item.availability_status || '')}
                   startEditing={(fieldName, value) => {
                     startEditing(fieldName, item.availability_status || '');
                   }}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   options={AVAILABILITY_STATUS_OPTIONS}
                 />
                 {renderField('Availability Status Notes', item.availability_status_notes)}
                 <EditableSelectField
                   fieldName="condition"
                   label="Condition"
                   value={item.condition || ''}
                   isEditing={editingFields.has('condition')}
                   isSaving={savingFields.has('condition')}
                   editValue={editValues.condition !== undefined ? 
                     String(editValues.condition) : 
                     (item.condition || '')}
                   startEditing={(fieldName, value) => {
                     startEditing(fieldName, item.condition || '');
                   }}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                   options={CONDITION_OPTIONS}
                 />
                 {renderField('Condition Notes', item.condition_notes)}
                 {renderField('IPM Issues', item.ipm_issues)}
                 {renderField('Conservation Treatments Performed', item.conservation_treatments_performed)}
               </Box>
             </CardContent>
           </Card>

           {/* Location */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Location
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {renderField('Municipality or Township', item.municipality_or_township)}
                 {renderField('County or Parish', item.county_or_parish)}
                 {renderField('State or Province', item.state_or_province)}
                 {renderField('Country or Territory', item.country_or_territory)}
                 {renderField('Global Region', item.global_region)}
                 {renderField('Recording Context', item.recording_context)}
                 {renderField('Public Event', item.public_event)}
               </Box>
             </CardContent>
           </Card>

           {/* External */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 External
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 <EditableTextField
                   fieldName="temporary_accession_number"
                   label="Temporary Accession Number"
                   value={item.temporary_accession_number || ''}
                   isEditing={editingFields.has('temporary_accession_number')}
                   isSaving={savingFields.has('temporary_accession_number')}
                   editValue={editValues.temporary_accession_number || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 <EditableTextField
                   fieldName="lender_loan_number"
                   label="Lender Loan Number"
                   value={item.lender_loan_number || ''}
                   isEditing={editingFields.has('lender_loan_number')}
                   isSaving={savingFields.has('lender_loan_number')}
                   editValue={editValues.lender_loan_number || ''}
                   startEditing={startEditing}
                   cancelEditing={cancelEditing}
                   saveField={saveField}
                   updateEditValue={updateEditValue}
                 />
                 {renderField('Other Institutional Number', item.other_institutional_number)}
               </Box>
             </CardContent>
           </Card>

           {/* Metadata History */}
           <Card sx={{ mb: 2 }} elevation={1}>
             <CardContent>
               <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                 Metadata History
               </Typography>
               <Divider sx={{ mb: 2 }} />
               <Box>
                 {renderField('Last Updated', item.updated)}
                 {renderField('Modified By', item.modified_by)}
                 {renderField('Added', item.added)}
               </Box>
             </CardContent>
           </Card>
        </Box>
      </Box>

      {/* Secure Delete Section - Only visible to Archivists and Admins */}
      {hasDeleteAccess(authState.user) && (
        <Box sx={{ mt: 4, pt: 3, borderTop: '2px solid', borderColor: 'error.main' }}>
          <Card sx={{ border: '1px solid', borderColor: 'error.main' }} elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'error.main' }}>
                ⚠️ Danger Zone
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Permanently delete this item and all its associated data. This action cannot be undone.
              </Typography>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                sx={{ fontWeight: 'medium' }}
              >
                Delete Item
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Double Confirmation Delete Dialog */}
      <Dialog
        open={showDeleteConfirmation}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          ⚠️ Confirm Item Deletion
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            You are about to permanently delete this item:
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              Catalog Number: {item?.catalog_number}
            </Typography>
            <Typography variant="body2">
              Title: {item?.primary_title || 'No title'}
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 2, color: 'error.main', fontWeight: 'medium' }}>
            This action cannot be undone. All associated data will be permanently lost.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            To confirm deletion, please type the catalog number <strong>{item?.catalog_number}</strong> below:
          </Typography>
          <TextField
            fullWidth
            label="Type catalog number to confirm"
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value)}
            error={deleteConfirmationText !== '' && deleteConfirmationText !== item?.catalog_number}
            helperText={
              deleteConfirmationText !== '' && deleteConfirmationText !== item?.catalog_number
                ? 'Catalog number does not match'
                : ''
            }
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteConfirmationText !== item?.catalog_number}
            startIcon={<DeleteIcon />}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemDetail;