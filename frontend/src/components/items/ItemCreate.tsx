import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Paper,
  Box,
  TextField,
  Button,
  Stack,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Autocomplete,
  FormHelperText,
  IconButton,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { itemsAPI, collectionsAPI, collaboratorsAPI, languoidsAPI, type Item, type Collection, type Collaborator, type Languoid } from '../../services/api';

interface ItemFormData {
  // Basic fields
  catalog_number: string;
  call_number: string;
  access_level: string;
  resource_type: string;
  
  // Titles
  titles: Array<{
    title: string;
    language_name: string;
    default: boolean;
  }>;
  
  // Description
  description: string;
  language_description_type: string[];
  associated_ephemera: string;
  
  // Relationships
  collection: number | null;
  language: number[];
  collaborator: number[];
  
  // Dates
  creation_date: string;
  accession_date: string;
  
  // Genre
  genre: string[];
  
  // Access & Permissions
  access_level_restrictions: string;
  copyrighted_notes: string;
  permission_to_publish_online: boolean | null;
  
  // Accessions
  accession_number: string;
  type_of_accession: string;
  acquisition_notes: string;
  project_grant: string;
  collector_name: string;
  collector_info: string;
  collectors_number: string;
  collection_date: string;
  collecting_notes: string;
  depositor_name: string;
  depositor_contact_information: string;
  deposit_date: string;
  
  // Digitization
  original_format_medium: string;
  recorded_on: string;
  equipment_used: string;
  software_used: string;
  conservation_recommendation: string;
  location_of_original: string;
  other_information: string;
  
  // Books
  publisher: string;
  publisher_address: string;
  isbn: string;
  loc_catalog_number: string;
  total_number_of_pages_and_physical_description: string;
  
  // Condition
  availability_status: string;
  availability_status_notes: string;
  condition: string;
  condition_notes: string;
  ipm_issues: string;
  conservation_treatments_performed: string;
  
  // Location
  municipality_or_township: string;
  county_or_parish: string;
  state_or_province: string;
  country_or_territory: string;
  global_region: string;
  recording_context: string;
  public_event: string;
  
  // External
  temporary_accession_number: string;
  lender_loan_number: string;
  other_institutional_number: string;
}

interface ItemCreateProps {
  onSuccess?: (item: Item) => void;
  onCancel?: () => void;
}

const ItemCreate: React.FC<ItemCreateProps> = ({
  onSuccess,
  onCancel,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Form state
  const [formData, setFormData] = useState<ItemFormData>({
    // Basic fields
    catalog_number: '',
    call_number: '',
    access_level: '1', // Default to Open Access
    resource_type: '',
    
    // Titles
    titles: [{ title: '', language_name: '', default: true }],
    
    // Description
    description: '',
    language_description_type: [],
    associated_ephemera: '',
    
    // Relationships
    collection: null,
    language: [],
    collaborator: [],
    
    // Dates
    creation_date: '',
    accession_date: '',
    
    // Genre
    genre: [],
    
    // Access & Permissions
    access_level_restrictions: '',
    copyrighted_notes: '',
    permission_to_publish_online: null,
    
    // Accessions
    accession_number: '',
    type_of_accession: '',
    acquisition_notes: '',
    project_grant: '',
    collector_name: '',
    collector_info: '',
    collectors_number: '',
    collection_date: '',
    collecting_notes: '',
    depositor_name: '',
    depositor_contact_information: '',
    deposit_date: '',
    
    // Digitization
    original_format_medium: '',
    recorded_on: '',
    equipment_used: '',
    software_used: '',
    conservation_recommendation: '',
    location_of_original: '',
    other_information: '',
    
    // Books
    publisher: '',
    publisher_address: '',
    isbn: '',
    loc_catalog_number: '',
    total_number_of_pages_and_physical_description: '',
    
    // Condition
    availability_status: '',
    availability_status_notes: '',
    condition: '',
    condition_notes: '',
    ipm_issues: '',
    conservation_treatments_performed: '',
    
    // Location
    municipality_or_township: '',
    county_or_parish: '',
    state_or_province: '',
    country_or_territory: '',
    global_region: '',
    recording_context: '',
    public_event: '',
    
    // External
    temporary_accession_number: '',
    lender_loan_number: '',
    other_institutional_number: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Options data
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [languoids, setLanguoids] = useState<Languoid[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Choice options (from Django model)
  const accessLevelOptions = [
    { value: '1', label: '1 - Open Access' },
    { value: '2', label: '2 - Materials available onsite' },
    { value: '3', label: '3 - Time limited access' },
    { value: '4', label: '4 - Depositor controlled access' },
  ];

  const resourceTypeOptions = [
    { value: 'audio', label: 'Audio' },
    { value: 'audio-video', label: 'Audio/Video' },
    { value: 'manuscript', label: 'Manuscript' },
    { value: 'image', label: 'Image (Photograph)' },
    { value: 'dataset', label: 'Dataset' },
    { value: 'publication_book', label: 'Publication: Book' },
    { value: 'publication_article', label: 'Publication: Journal Article' },
    { value: 'website', label: 'Website' },
    { value: 'other', label: 'Other' },
  ];

  const genreOptions = [
    { value: 'ceremonial', label: 'Ceremonial' },
    { value: 'conversation', label: 'Conversation' },
    { value: 'correspondence', label: 'Correspondence' },
    { value: 'drama', label: 'Drama' },
    { value: 'educational', label: 'Educational material' },
    { value: 'elicitation', label: 'Elicitation' },
    { value: 'ethnography', label: 'Ethnography' },
    { value: 'interview', label: 'Interview' },
    { value: 'narrative', label: 'Narrative' },
    { value: 'oratory', label: 'Oratory' },
    { value: 'procedural_discourse', label: 'Procedural discourse' },
    { value: 'report', label: 'Report' },
    { value: 'singing', label: 'Singing' },
    { value: 'unintelligible', label: 'Unintelligible speech' },
  ];

  const languageDescriptionTypeOptions = [
    { value: 'grammar', label: 'Grammar' },
    { value: 'lexicon', label: 'Lexicon' },
    { value: 'phonology', label: 'Phonology' },
    { value: 'discourse', label: 'Discourse' },
    { value: 'sociolinguistics', label: 'Sociolinguistics' },
    { value: 'other', label: 'Other' },
  ];

  const typeOfAccessionOptions = [
    { value: 'donation', label: 'Donation' },
    { value: 'purchase', label: 'Purchase' },
    { value: 'loan', label: 'Loan' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'other', label: 'Other' },
  ];

  const originalFormatMediumOptions = [
    { value: 'analog_tape', label: 'Analog Tape' },
    { value: 'digital_tape', label: 'Digital Tape' },
    { value: 'cd', label: 'CD' },
    { value: 'dvd', label: 'DVD' },
    { value: 'hard_drive', label: 'Hard Drive' },
    { value: 'flash_drive', label: 'Flash Drive' },
    { value: 'paper', label: 'Paper' },
    { value: 'other', label: 'Other' },
  ];

  const availabilityStatusOptions = [
    { value: 'available', label: 'available' },
    { value: 'restricted', label: 'Restricted' },
    { value: 'unavailable', label: 'Unavailable' },
  ];

  const conditionOptions = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'missing', label: 'Missing' },
  ];

  // Load options data on component mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        const [collectionsData, collaboratorsData, languoidsData] = await Promise.all([
          collectionsAPI.list(),
          collaboratorsAPI.list(),
          languoidsAPI.list(),
        ]);
        
        setCollections(collectionsData.results);
        setCollaborators(collaboratorsData.results);
        setLanguoids(languoidsData.results);
      } catch (err: any) {
        console.error('Failed to load options:', err);
        setError('Failed to load form options. Please refresh the page.');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  // Handle form field changes
  const handleFieldChange = (field: keyof ItemFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle title changes
  const handleTitleChange = (index: number, field: 'title' | 'language_name' | 'default', value: any) => {
    setFormData(prev => ({
      ...prev,
      titles: prev.titles.map((title, i) => 
        i === index ? { ...title, [field]: value } : title
      ),
    }));
  };

  // Add new title
  const addTitle = () => {
    setFormData(prev => ({
      ...prev,
      titles: [...prev.titles, { title: '', language_name: '', default: false }],
    }));
  };

  // Remove title
  const removeTitle = (index: number) => {
    if (formData.titles.length > 1) {
      setFormData(prev => ({
        ...prev,
        titles: prev.titles.filter((_, i) => i !== index),
      }));
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Required fields
    if (!formData.catalog_number.trim()) {
      errors.catalog_number = 'Catalog number is required';
    }

    if (!formData.access_level) {
      errors.access_level = 'Access level is required';
    }

    if (!formData.resource_type) {
      errors.resource_type = 'Resource type is required';
    }

    // At least one title required
    const validTitles = formData.titles.filter(t => t.title.trim());
    if (validTitles.length === 0) {
      errors.titles = 'At least one title is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Prepare data for API
      const apiData = {
        catalog_number: formData.catalog_number.trim(),
        call_number: formData.call_number.trim() || undefined,
        access_level: formData.access_level,
        accession_date: formData.accession_date || undefined,
        creation_date: formData.creation_date || undefined,
        resource_type: formData.resource_type,
        genre: formData.genre,
        description: formData.description.trim() || undefined,
        depositor_name: formData.depositor_name.trim() || undefined,
        collection: formData.collection || undefined,
        language: formData.language,
        collaborator: formData.collaborator,
        // Note: titles will need to be handled separately as they're in a related model
      };

      const newItem = await itemsAPI.create(apiData);
      
      if (onSuccess) {
        onSuccess(newItem);
      } else {
        navigate(`/items/${newItem.id}`);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create item';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/items');
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack 
          direction={isMobile ? 'column' : 'row'} 
          justifyContent="space-between" 
          alignItems={isMobile ? 'stretch' : 'center'}
          spacing={2}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={handleCancel}
              aria-label="Back to Items List"
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
              Add New Item
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit} noValidate>
          {/* Two-column layout matching ItemDetail */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3 
          }}>
            {/* Left column - Primary information */}
            <Box sx={{ flex: { xs: 1, md: 2 } }}>
              {/* Catalog Number */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Item Identification
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <TextField
                    fullWidth
                    required
                    label="Catalog Number"
                    value={formData.catalog_number}
                    onChange={(e) => handleFieldChange('catalog_number', e.target.value)}
                    error={!!fieldErrors.catalog_number}
                    helperText={fieldErrors.catalog_number}
                    placeholder="Enter unique catalog number"
                  />
                </CardContent>
              </Card>

              {/* Titles */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                      Titles
                    </Typography>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={addTitle}
                      size="small"
                    >
                      Add Title
                    </Button>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  {fieldErrors.titles && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {fieldErrors.titles}
                    </Alert>
                  )}

                  <Stack spacing={2}>
                    {formData.titles.map((title, index) => (
                      <Box key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Stack spacing={2}>
                          <Box sx={{ 
                            display: 'flex', 
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 2,
                            alignItems: { xs: 'stretch', sm: 'center' }
                          }}>
                            <TextField
                              fullWidth
                              required={index === 0}
                              label={`Title ${index + 1}`}
                              value={title.title}
                              onChange={(e) => handleTitleChange(index, 'title', e.target.value)}
                            />
                            
                            <TextField
                              fullWidth
                              label="Language"
                              value={title.language_name}
                              onChange={(e) => handleTitleChange(index, 'language_name', e.target.value)}
                              sx={{ minWidth: { sm: '200px' } }}
                            />
                            
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 1,
                              minWidth: { sm: '150px' },
                              justifyContent: { xs: 'flex-start', sm: 'center' }
                            }}>
                              {title.default && (
                                <Chip label="Primary" size="small" color="primary" />
                              )}
                              {formData.titles.length > 1 && (
                                <IconButton
                                  onClick={() => removeTitle(index)}
                                  size="small"
                                  color="error"
                                  aria-label={`Remove title ${index + 1}`}
                                >
                                  <CancelIcon />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Description */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Description
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Scope and Content"
                      value={formData.description}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      placeholder="Describe the content and scope of this item..."
                    />
                    
                    <Autocomplete
                      multiple
                      options={languageDescriptionTypeOptions}
                      getOptionLabel={(option) => option.label}
                      value={languageDescriptionTypeOptions.filter(option => formData.language_description_type.includes(option.value))}
                      onChange={(_, newValue) => {
                        handleFieldChange('language_description_type', newValue.map(option => option.value));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Language Description Type"
                          placeholder="Select types"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            variant="outlined"
                            label={option.label}
                            {...getTagProps({ index })}
                            key={option.value}
                          />
                        ))
                      }
                    />
                    
                    <TextField
                      fullWidth
                      label="Associated Ephemera"
                      value={formData.associated_ephemera}
                      onChange={(e) => handleFieldChange('associated_ephemera', e.target.value)}
                      placeholder="Related materials or ephemera"
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Languages */}
              {!loadingOptions && (
                <Card sx={{ mb: 2 }} elevation={1}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                      Languages
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Autocomplete
                      multiple
                      options={languoids}
                      getOptionLabel={(option) => option.name}
                      value={languoids.filter(lang => formData.language.includes(lang.id))}
                      onChange={(_, newValue) => {
                        handleFieldChange('language', newValue.map(lang => lang.id));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Languages"
                          placeholder="Select languages"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            variant="outlined"
                            label={option.name}
                            {...getTagProps({ index })}
                            key={option.id}
                          />
                        ))
                      }
                    />
                  </CardContent>
                </Card>
              )}

              {/* Collaborators */}
              {!loadingOptions && (
                <Card sx={{ mb: 2 }} elevation={1}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                      Collaborators
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Autocomplete
                      multiple
                      options={collaborators}
                      getOptionLabel={(option) => option.name}
                      value={collaborators.filter(collab => formData.collaborator.includes(collab.id))}
                      onChange={(_, newValue) => {
                        handleFieldChange('collaborator', newValue.map(collab => collab.id));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Collaborators"
                          placeholder="Select collaborators"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            variant="outlined"
                            label={option.name}
                            {...getTagProps({ index })}
                            key={option.id}
                          />
                        ))
                      }
                    />
                  </CardContent>
                </Card>
              )}

              {/* Files */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Files
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" fontStyle="italic">
                    File upload functionality will be available after item creation
                  </Typography>
                </CardContent>
              </Card>

              {/* Access & Permissions */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Access & Permissions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Access Level Restrictions"
                      value={formData.access_level_restrictions}
                      onChange={(e) => handleFieldChange('access_level_restrictions', e.target.value)}
                      placeholder="Describe any access restrictions"
                    />
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Copyright Notes"
                      value={formData.copyrighted_notes}
                      onChange={(e) => handleFieldChange('copyrighted_notes', e.target.value)}
                      placeholder="Copyright information and notes"
                    />
                    
                    <FormControl fullWidth>
                      <InputLabel>Permission to Publish Online</InputLabel>
                      <Select
                        value={formData.permission_to_publish_online === null ? '' : formData.permission_to_publish_online.toString()}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleFieldChange('permission_to_publish_online', 
                            value === '' ? null : value === 'true'
                          );
                        }}
                        label="Permission to Publish Online"
                      >
                        <MenuItem value="">Not specified</MenuItem>
                        <MenuItem value="true">Yes</MenuItem>
                        <MenuItem value="false">No</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </CardContent>
              </Card>

              {/* Accessions */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Accessions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="Accession Number"
                        value={formData.accession_number}
                        onChange={(e) => handleFieldChange('accession_number', e.target.value)}
                      />
                      
                      <FormControl fullWidth>
                        <InputLabel>Type of Accession</InputLabel>
                        <Select
                          value={formData.type_of_accession}
                          onChange={(e) => handleFieldChange('type_of_accession', e.target.value)}
                          label="Type of Accession"
                        >
                          {typeOfAccessionOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Acquisition Notes"
                      value={formData.acquisition_notes}
                      onChange={(e) => handleFieldChange('acquisition_notes', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      label="Project/Grant"
                      value={formData.project_grant}
                      onChange={(e) => handleFieldChange('project_grant', e.target.value)}
                    />
                    
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="Collector Name"
                        value={formData.collector_name}
                        onChange={(e) => handleFieldChange('collector_name', e.target.value)}
                      />
                      
                      <TextField
                        fullWidth
                        label="Collector's Number"
                        value={formData.collectors_number}
                        onChange={(e) => handleFieldChange('collectors_number', e.target.value)}
                      />
                    </Box>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Collector Info"
                      value={formData.collector_info}
                      onChange={(e) => handleFieldChange('collector_info', e.target.value)}
                    />
                    
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="Collection Date"
                        value={formData.collection_date}
                        onChange={(e) => handleFieldChange('collection_date', e.target.value)}
                        placeholder="e.g., 2023-10-11, October 2023"
                      />
                      
                      <TextField
                        fullWidth
                        label="Deposit Date"
                        value={formData.deposit_date}
                        onChange={(e) => handleFieldChange('deposit_date', e.target.value)}
                        placeholder="e.g., 2023-10-11, October 2023"
                      />
                    </Box>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Collecting Notes"
                      value={formData.collecting_notes}
                      onChange={(e) => handleFieldChange('collecting_notes', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      label="Depositor Name"
                      value={formData.depositor_name}
                      onChange={(e) => handleFieldChange('depositor_name', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Depositor Contact Information"
                      value={formData.depositor_contact_information}
                      onChange={(e) => handleFieldChange('depositor_contact_information', e.target.value)}
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Digitization */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Digitization
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>Original Format Medium</InputLabel>
                      <Select
                        value={formData.original_format_medium}
                        onChange={(e) => handleFieldChange('original_format_medium', e.target.value)}
                        label="Original Format Medium"
                      >
                        {originalFormatMediumOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <TextField
                      fullWidth
                      label="Recorded On"
                      value={formData.recorded_on}
                      onChange={(e) => handleFieldChange('recorded_on', e.target.value)}
                    />
                    
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="Equipment Used"
                        value={formData.equipment_used}
                        onChange={(e) => handleFieldChange('equipment_used', e.target.value)}
                      />
                      
                      <TextField
                        fullWidth
                        label="Software Used"
                        value={formData.software_used}
                        onChange={(e) => handleFieldChange('software_used', e.target.value)}
                      />
                    </Box>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Conservation Recommendation"
                      value={formData.conservation_recommendation}
                      onChange={(e) => handleFieldChange('conservation_recommendation', e.target.value)}
                    />
                    
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="Location of Original"
                        value={formData.location_of_original}
                        onChange={(e) => handleFieldChange('location_of_original', e.target.value)}
                      />
                      
                      <TextField
                        fullWidth
                        label="Other Information"
                        value={formData.other_information}
                        onChange={(e) => handleFieldChange('other_information', e.target.value)}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Books */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Books
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="Publisher"
                        value={formData.publisher}
                        onChange={(e) => handleFieldChange('publisher', e.target.value)}
                      />
                      
                      <TextField
                        fullWidth
                        label="ISBN"
                        value={formData.isbn}
                        onChange={(e) => handleFieldChange('isbn', e.target.value)}
                      />
                    </Box>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Publisher Address"
                      value={formData.publisher_address}
                      onChange={(e) => handleFieldChange('publisher_address', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      label="LOC Catalog Number"
                      value={formData.loc_catalog_number}
                      onChange={(e) => handleFieldChange('loc_catalog_number', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Total Number of Pages and Physical Description"
                      value={formData.total_number_of_pages_and_physical_description}
                      onChange={(e) => handleFieldChange('total_number_of_pages_and_physical_description', e.target.value)}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Right column - Metadata */}
            <Box sx={{ flex: 1 }}>
              {/* Collection Information */}
              {!loadingOptions && (
                <Card sx={{ mb: 2 }} elevation={1}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                      Collection Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Stack spacing={2}>
                      <Autocomplete
                        options={collections}
                        getOptionLabel={(option) => `${option.name} (${option.collection_abbr})`}
                        value={collections.find(c => c.id === formData.collection) || null}
                        onChange={(_, newValue) => {
                          handleFieldChange('collection', newValue?.id || null);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Collection"
                          />
                        )}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Item Details */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Item Details
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <FormControl 
                      fullWidth 
                      required 
                      error={!!fieldErrors.access_level}
                    >
                      <InputLabel>Access Level</InputLabel>
                      <Select
                        value={formData.access_level}
                        onChange={(e) => handleFieldChange('access_level', e.target.value)}
                        label="Access Level"
                      >
                        {accessLevelOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldErrors.access_level && (
                        <FormHelperText>{fieldErrors.access_level}</FormHelperText>
                      )}
                    </FormControl>

                    <FormControl 
                      fullWidth 
                      required 
                      error={!!fieldErrors.resource_type}
                    >
                      <InputLabel>Resource Type</InputLabel>
                      <Select
                        value={formData.resource_type}
                        onChange={(e) => handleFieldChange('resource_type', e.target.value)}
                        label="Resource Type"
                      >
                        {resourceTypeOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldErrors.resource_type && (
                        <FormHelperText>{fieldErrors.resource_type}</FormHelperText>
                      )}
                    </FormControl>
                    
                    <TextField
                      fullWidth
                      label="Call Number"
                      value={formData.call_number}
                      onChange={(e) => handleFieldChange('call_number', e.target.value)}
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Important Dates */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Important Dates
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Creation Date"
                      value={formData.creation_date}
                      onChange={(e) => handleFieldChange('creation_date', e.target.value)}
                      placeholder="e.g., 2023, circa 1950, 1990s"
                    />
                    
                    <TextField
                      fullWidth
                      label="Accession Date"
                      value={formData.accession_date}
                      onChange={(e) => handleFieldChange('accession_date', e.target.value)}
                      placeholder="e.g., 2023-10-11, October 2023"
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Genre */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Genre
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Autocomplete
                    multiple
                    options={genreOptions}
                    getOptionLabel={(option) => option.label}
                    value={genreOptions.filter(option => formData.genre.includes(option.value))}
                    onChange={(_, newValue) => {
                      handleFieldChange('genre', newValue.map(option => option.value));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Genres"
                        placeholder="Select genres"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option.label}
                          {...getTagProps({ index })}
                          key={option.value}
                        />
                      ))
                    }
                  />
                </CardContent>
              </Card>

              {/* Browse Categories */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Browse Categories
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" fontStyle="italic">
                    Browse categories will be available after item creation
                  </Typography>
                </CardContent>
              </Card>

              {/* Condition */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Condition
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>Availability Status</InputLabel>
                      <Select
                        value={formData.availability_status}
                        onChange={(e) => handleFieldChange('availability_status', e.target.value)}
                        label="Availability Status"
                      >
                        {availabilityStatusOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Availability Status Notes"
                      value={formData.availability_status_notes}
                      onChange={(e) => handleFieldChange('availability_status_notes', e.target.value)}
                    />
                    
                    <FormControl fullWidth>
                      <InputLabel>Condition</InputLabel>
                      <Select
                        value={formData.condition}
                        onChange={(e) => handleFieldChange('condition', e.target.value)}
                        label="Condition"
                      >
                        {conditionOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Condition Notes"
                      value={formData.condition_notes}
                      onChange={(e) => handleFieldChange('condition_notes', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="IPM Issues"
                      value={formData.ipm_issues}
                      onChange={(e) => handleFieldChange('ipm_issues', e.target.value)}
                      placeholder="Integrated Pest Management issues"
                    />
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Conservation Treatments Performed"
                      value={formData.conservation_treatments_performed}
                      onChange={(e) => handleFieldChange('conservation_treatments_performed', e.target.value)}
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Location */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    Location
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="Municipality or Township"
                        value={formData.municipality_or_township}
                        onChange={(e) => handleFieldChange('municipality_or_township', e.target.value)}
                      />
                      
                      <TextField
                        fullWidth
                        label="County or Parish"
                        value={formData.county_or_parish}
                        onChange={(e) => handleFieldChange('county_or_parish', e.target.value)}
                      />
                    </Box>
                    
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2 
                    }}>
                      <TextField
                        fullWidth
                        label="State or Province"
                        value={formData.state_or_province}
                        onChange={(e) => handleFieldChange('state_or_province', e.target.value)}
                      />
                      
                      <TextField
                        fullWidth
                        label="Country or Territory"
                        value={formData.country_or_territory}
                        onChange={(e) => handleFieldChange('country_or_territory', e.target.value)}
                      />
                    </Box>
                    
                    <TextField
                      fullWidth
                      label="Global Region"
                      value={formData.global_region}
                      onChange={(e) => handleFieldChange('global_region', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      label="Recording Context"
                      value={formData.recording_context}
                      onChange={(e) => handleFieldChange('recording_context', e.target.value)}
                      placeholder="Context where recording took place"
                    />
                    
                    <TextField
                      fullWidth
                      label="Public Event"
                      value={formData.public_event}
                      onChange={(e) => handleFieldChange('public_event', e.target.value)}
                      placeholder="Public event information"
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* External */}
              <Card sx={{ mb: 2 }} elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                    External
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Temporary Accession Number"
                      value={formData.temporary_accession_number}
                      onChange={(e) => handleFieldChange('temporary_accession_number', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      label="Lender Loan Number"
                      value={formData.lender_loan_number}
                      onChange={(e) => handleFieldChange('lender_loan_number', e.target.value)}
                    />
                    
                    <TextField
                      fullWidth
                      label="Other Institutional Number"
                      value={formData.other_institutional_number}
                      onChange={(e) => handleFieldChange('other_institutional_number', e.target.value)}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Form Actions */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCancel}
              disabled={loading}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || loadingOptions}
              startIcon={loading ? <CircularProgress size={20} aria-label="Creating item" /> : <SaveIcon />}
            >
              {loading ? 'Creating...' : 'Create Item'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default ItemCreate;