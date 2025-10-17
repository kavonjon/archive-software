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
  IconButton,
  Card,
  CardContent,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { collectionsAPI, languoidsAPI, type Collection, type Languoid } from '../../services/api';

interface CollectionFormData {
  // Required fields
  collection_abbr: string;
  name: string;
  
  // Optional basic fields
  extent: string;
  abstract: string;
  description: string;
  background: string;
  conventions: string;
  acquisition: string;
  access_statement: string;
  related_publications_collections: string;
  citation_authors: string;
  expecting_additions: boolean | null;
  
  // Relationships
  languages: number[];
}

interface CollectionCreateProps {
  onSuccess?: (collection: Collection) => void;
  onCancel?: () => void;
}

const CollectionCreate: React.FC<CollectionCreateProps> = ({
  onSuccess,
  onCancel,
}) => {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState<CollectionFormData>({
    // Required fields
    collection_abbr: '',
    name: '',
    
    // Optional basic fields
    extent: '',
    abstract: '',
    description: '',
    background: '',
    conventions: '',
    acquisition: '',
    access_statement: '',
    related_publications_collections: '',
    citation_authors: '',
    expecting_additions: null,
    
    // Relationships
    languages: [],
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Options for dropdowns
  const [languageOptions, setLanguageOptions] = useState<Languoid[]>([]);

  // Load dropdown options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        
        // Load languages
        const languagesResponse = await languoidsAPI.list();
        setLanguageOptions(languagesResponse.results);
        
      } catch (err: any) {
        console.error('Failed to load options:', err);
        setError('Failed to load form options');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  // Handle form field changes
  const handleChange = (field: keyof CollectionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Required fields
    if (!formData.collection_abbr.trim()) {
      errors.collection_abbr = 'Collection abbreviation is required';
    } else if (formData.collection_abbr.length > 10) {
      errors.collection_abbr = 'Collection abbreviation must be 10 characters or less';
    }

    if (!formData.name.trim()) {
      errors.name = 'Collection name is required';
    } else if (formData.name.length > 255) {
      errors.name = 'Collection name must be 255 characters or less';
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
        collection_abbr: formData.collection_abbr.trim(),
        name: formData.name.trim(),
        extent: formData.extent.trim() || undefined,
        abstract: formData.abstract.trim() || undefined,
        description: formData.description.trim() || undefined,
        background: formData.background.trim() || undefined,
        conventions: formData.conventions.trim() || undefined,
        acquisition: formData.acquisition.trim() || undefined,
        access_statement: formData.access_statement.trim() || undefined,
        related_publications_collections: formData.related_publications_collections.trim() || undefined,
        citation_authors: formData.citation_authors.trim() || undefined,
        expecting_additions: formData.expecting_additions,
        languages: formData.languages,
      };

      const newCollection = await collectionsAPI.create(apiData);
      
      if (onSuccess) {
        onSuccess(newCollection);
      } else {
        navigate(`/collections/${newCollection.id}`);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create collection';
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
      navigate('/collections');
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton
            onClick={handleCancel}
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
            Create New Collection
          </Typography>
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                {/* Collection Abbreviation */}
                <TextField
                  label="Collection Abbreviation"
                  value={formData.collection_abbr}
                  onChange={(e) => handleChange('collection_abbr', e.target.value)}
                  error={!!fieldErrors.collection_abbr}
                  helperText={fieldErrors.collection_abbr}
                  required
                  inputProps={{ maxLength: 10 }}
                  disabled={loading}
                />

                {/* Collection Name */}
                <TextField
                  label="Collection Name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  error={!!fieldErrors.name}
                  helperText={fieldErrors.name}
                  required
                  inputProps={{ maxLength: 255 }}
                  disabled={loading}
                />
              </Box>

              {/* Extent */}
              <Box sx={{ mt: 3 }}>
                <TextField
                  label="Extent"
                  value={formData.extent}
                  onChange={(e) => handleChange('extent', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Box>

              {/* Expecting Additions */}
              <Box sx={{ mt: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Expecting Additions</InputLabel>
                  <Select
                    value={formData.expecting_additions === null ? '' : formData.expecting_additions.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleChange('expecting_additions', 
                        value === '' ? null : value === 'true'
                      );
                    }}
                    disabled={loading}
                  >
                    <MenuItem value="">Not specified</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>

          {/* Languages */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Languages
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Autocomplete
                multiple
                options={languageOptions}
                getOptionLabel={(option) => option.name}
                value={languageOptions.filter(lang => formData.languages.includes(lang.id))}
                onChange={(_, newValue) => {
                  handleChange('languages', newValue.map(lang => lang.id));
                }}
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
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Languages"
                    placeholder="Select languages..."
                  />
                )}
                disabled={loading || loadingOptions}
              />
            </CardContent>
          </Card>

          {/* Descriptions */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Descriptions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={3}>
                {/* Abstract */}
                <TextField
                  label="Abstract"
                  value={formData.abstract}
                  onChange={(e) => handleChange('abstract', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                />

                {/* Description */}
                <TextField
                  label="Description of Scope and Content"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  multiline
                  rows={4}
                  fullWidth
                  disabled={loading}
                />

                {/* Background */}
                <TextField
                  label="Background Information"
                  value={formData.background}
                  onChange={(e) => handleChange('background', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                />

                {/* Conventions */}
                <TextField
                  label="Description of Arrangement, Collector Conventions"
                  value={formData.conventions}
                  onChange={(e) => handleChange('conventions', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                />

                {/* Acquisition */}
                <TextField
                  label="Acquisition Information"
                  value={formData.acquisition}
                  onChange={(e) => handleChange('acquisition', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                />

                {/* Access Statement */}
                <TextField
                  label="Access/Use Statement"
                  value={formData.access_statement}
                  onChange={(e) => handleChange('access_statement', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                />

                {/* Related Publications */}
                <TextField
                  label="Related Publications/Collections"
                  value={formData.related_publications_collections}
                  onChange={(e) => handleChange('related_publications_collections', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Creators */}
          <Card sx={{ mb: 2 }} elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                Creators
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <TextField
                label="Citation Authors"
                value={formData.citation_authors}
                onChange={(e) => handleChange('citation_authors', e.target.value)}
                multiline
                rows={2}
                fullWidth
                disabled={loading}
              />
            </CardContent>
          </Card>

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
              startIcon={loading ? <CircularProgress size={20} aria-label="Creating collection" /> : <SaveIcon />}
            >
              {loading ? 'Creating...' : 'Create Collection'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default CollectionCreate;
