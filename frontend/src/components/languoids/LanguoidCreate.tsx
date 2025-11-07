import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Box,
  Alert,
  Divider,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { languoidsAPI, LANGUOID_LEVEL_CHOICES, LANGUOID_LEVEL_GLOTTOLOG_CHOICES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasEditAccess } from '../../utils/permissions';

interface LanguoidOption {
  id: number;
  name: string;
  glottocode: string;
  display_name: string;
}

interface FormData {
  name: string;
  name_abbrev: string;
  iso: string;
  glottocode: string;
  level_glottolog: string;
  alt_names: string[];
  parent_languoid: number | null;
  region: string;
  latitude: string;
  longitude: string;
  dialects: string;
  tribes: string;
  notes: string;
}

const initialFormData: FormData = {
  name: '',
  name_abbrev: '',
  iso: '',
  glottocode: '',
  level_glottolog: '',
  alt_names: [],
  parent_languoid: null,
  region: '',
  latitude: '',
  longitude: '',
  dialects: '',
  tribes: '',
  notes: '',
};

const LanguoidCreate: React.FC = () => {
  const navigate = useNavigate();
  const { state: authState } = useAuth();

  // Form state
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validation states
  const [glottocodeValidation, setGlottocodeValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  // Parent languoid autocomplete state
  const [parentOptions, setParentOptions] = useState<LanguoidOption[]>([]);
  const [parentSearchQuery, setParentSearchQuery] = useState<string>('');
  const [loadingParents, setLoadingParents] = useState<boolean>(false);
  const [selectedParent, setSelectedParent] = useState<LanguoidOption | null>(null);

  // Alt names array state
  const [newAltName, setNewAltName] = useState<string>('');

  // Debounced glottocode validation (must be before any conditional returns)
  const validateGlottocode = useMemo(
    () => debounce(async (value: string) => {
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

  // Load parent languoid options with debounce
  // Filter based on the level_glottolog being created:
  // - If creating a dialect -> only show languages as parent options
  // - If creating a language or family -> only show families as parent options
  const loadParentOptions = useCallback(async (query: string, currentLevel: string) => {
    setLoadingParents(true);
    try {
      // Build params object
      const params: Record<string, string> = {
        page_size: '50',
      };
      
      // Filter parent options based on the level being created
      if (currentLevel === 'dialect') {
        // Dialects can only have languages as parents
        params['level_glottolog__in'] = 'language';
      } else if (currentLevel === 'language' || currentLevel === 'family') {
        // Languages and families can only have families as parents
        params['level_glottolog__in'] = 'family';
      } else {
        // If no level selected yet, show families and languages (exclude dialects)
        params['level_glottolog__in'] = 'family,language';
      }
      
      // Add search query if provided
      if (query) {
        params.search = query;
      }
      
      const response = await languoidsAPI.list(params);

      const mappedOptions: LanguoidOption[] = response.results.map((item: any) => ({
        id: item.id,
        name: item.name,
        glottocode: item.glottocode || '',
        display_name: item.glottocode 
          ? `${item.name} (${item.glottocode})`
          : item.name
      }));

      setParentOptions(mappedOptions);
    } catch (error) {
      console.error('Error loading parent options:', error);
      setParentOptions([]);
    } finally {
      setLoadingParents(false);
    }
  }, []);

  // Debounced search effect for parent options
  // Re-load when search query OR level changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadParentOptions(parentSearchQuery, formData.level_glottolog);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [parentSearchQuery, formData.level_glottolog, loadParentOptions]);

  // Load initial parent options on mount
  useEffect(() => {
    loadParentOptions('', formData.level_glottolog);
  }, [loadParentOptions, formData.level_glottolog]);

  // Clear selected parent when level changes (parent may no longer be valid)
  useEffect(() => {
    if (selectedParent) {
      // Only clear if the selected parent is no longer valid for the new level
      const shouldClear = 
        (formData.level_glottolog === 'dialect' && selectedParent.id) || // Dialect changed, need to check parent
        (formData.level_glottolog !== 'dialect' && formData.level_glottolog); // Language/family changed
      
      if (shouldClear) {
        setSelectedParent(null);
        setFormData(prev => ({ ...prev, parent_languoid: null }));
      }
    }
  }, [formData.level_glottolog]); // Only run when level changes

  // Check edit access (after hooks)
  if (!hasEditAccess(authState.user)) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          You don't have permission to create languoids.
        </Alert>
      </Container>
    );
  }

  const handleInputChange = (field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: string } }
  ) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Trigger glottocode validation
    if (field === 'glottocode') {
      validateGlottocode(value);
    }
  };

  // Handle parent languoid selection
  const handleParentChange = (_event: any, newValue: LanguoidOption | null) => {
    setSelectedParent(newValue);
    setFormData(prev => ({ ...prev, parent_languoid: newValue?.id || null }));
    
    // Clear parent error when user makes selection
    if (errors.parent_languoid) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.parent_languoid;
        return newErrors;
      });
    }
  };

  // Handle alt names array operations
  const handleAddAltName = () => {
    if (newAltName.trim()) {
      setFormData(prev => ({ 
        ...prev, 
        alt_names: [...prev.alt_names, newAltName.trim()] 
      }));
      setNewAltName('');
    }
  };

  const handleDeleteAltName = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      alt_names: prev.alt_names.filter((_, i) => i !== index) 
    }));
  };

  const handleAltNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAltName();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.level_glottolog) {
      newErrors.level_glottolog = 'Level is required';
    }

    // Glottocode format validation
    if (formData.glottocode && (formData.glottocode.length !== 8 || !formData.glottocode.slice(-4).match(/^\d{4}$/))) {
      newErrors.glottocode = 'Glottocode must be 8 characters with the last 4 being numeric';
    }

    // Check glottocode validation state
    if (formData.glottocode && (!glottocodeValidation.isValid || glottocodeValidation.isValidating)) {
      newErrors.glottocode = glottocodeValidation.error || 'Glottocode validation in progress';
    }

    // Validate numeric fields with bounds
    if (formData.latitude) {
      const lat = parseFloat(formData.latitude);
      if (isNaN(lat)) {
        newErrors.latitude = 'Latitude must be a valid number';
      } else if (lat < -90 || lat > 90) {
        newErrors.latitude = 'Latitude must be between -90 and 90';
      }
    }
    if (formData.longitude) {
      const lon = parseFloat(formData.longitude);
      if (isNaN(lon)) {
        newErrors.longitude = 'Longitude must be a valid number';
      } else if (lon < -180 || lon > 180) {
        newErrors.longitude = 'Longitude must be between -180 and 180';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Prepare data for submission
      const submitData: any = { ...formData };
      
      // Convert numeric fields
      if (submitData.latitude) {
        submitData.latitude = parseFloat(submitData.latitude);
      }
      if (submitData.longitude) {
        submitData.longitude = parseFloat(submitData.longitude);
      }

      // Remove empty string values (but keep arrays and null values)
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          delete submitData[key];
        }
      });

      // Ensure alt_names is an array (even if empty)
      if (!submitData.alt_names) {
        submitData.alt_names = [];
      }

      const newLanguoid = await languoidsAPI.create(submitData);
      // Navigate using glottocode if available, otherwise use ID
      const identifier = newLanguoid.glottocode || newLanguoid.id;
      navigate(`/languoids/${identifier}`);
    } catch (error) {
      console.error('Error creating languoid:', error);
      setSubmitError('Failed to create languoid. Please check your input and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('/languoids');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          Add New Languoid
        </Typography>
      </Box>

      {/* Submit Error */}
      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Two-column layout matching detail page */}
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
                  <TextField
                    fullWidth
                    label="Name"
                    value={formData.name}
                    onChange={handleInputChange('name')}
                    error={!!errors.name}
                    helperText={errors.name}
                    required
                  />

                  <TextField
                    fullWidth
                    label="Name Abbreviation"
                    value={formData.name_abbrev}
                    onChange={handleInputChange('name_abbrev')}
                    error={!!errors.name_abbrev}
                    helperText={errors.name_abbrev || 'Optional - defaults to full name if left blank'}
                  />

                  <TextField
                    fullWidth
                    label="ISO Code"
                    value={formData.iso}
                    onChange={handleInputChange('iso')}
                    error={!!errors.iso}
                    helperText={errors.iso}
                  />

                  <TextField
                    fullWidth
                    label="Glottocode"
                    value={formData.glottocode}
                    onChange={handleInputChange('glottocode')}
                    error={!!errors.glottocode || !glottocodeValidation.isValid}
                    helperText={
                      errors.glottocode || 
                      glottocodeValidation.error || 
                      (glottocodeValidation.isValidating ? 'Checking uniqueness...' : 
                       formData.glottocode && glottocodeValidation.isValid ? 'Valid and unique' : 
                       'Format: 8 characters, last 4 numeric (e.g., abcd1234)')
                    }
                    InputProps={{
                      endAdornment: glottocodeValidation.isValidating ? (
                        <CircularProgress size={20} />
                      ) : null
                    }}
                  />

                  <FormControl fullWidth required error={!!errors.level_glottolog}>
                    <InputLabel>Level</InputLabel>
                    <Select
                      value={formData.level_glottolog}
                      label="Level"
                      onChange={handleInputChange('level_glottolog')}
                    >
                      {LANGUOID_LEVEL_GLOTTOLOG_CHOICES.map((choice) => (
                        <MenuItem key={choice.value} value={choice.value}>
                          {choice.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.level_glottolog && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {errors.level_glottolog}
                      </Typography>
                    )}
                  </FormControl>

                  {/* Alternate Names - Array Field */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                      Alternate Names
                    </Typography>
                    
                    {/* Display existing alt names as chips */}
                    {formData.alt_names.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {formData.alt_names.map((name, index) => (
                          <Chip
                            key={index}
                            label={name}
                            size="small"
                            onDelete={() => handleDeleteAltName(index)}
                          />
                        ))}
                      </Box>
                    )}
                    
                    {/* Input field for adding new alt names */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={newAltName}
                        onChange={(e) => setNewAltName(e.target.value)}
                        placeholder="Add alternate name..."
                        onKeyDown={handleAltNameKeyDown}
                      />
                      <IconButton
                        size="small"
                        onClick={handleAddAltName}
                        disabled={!newAltName.trim()}
                        color="primary"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
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
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {!formData.level_glottolog && (
                        <>Select a level above to see appropriate parent options. </>
                      )}
                      {formData.level_glottolog === 'dialect' && (
                        <>Dialects can only have languages as parents. </>
                      )}
                      {(formData.level_glottolog === 'language' || formData.level_glottolog === 'family') && (
                        <>Languages and families can only have families as parents. </>
                      )}
                      Family, primary subgroup, and secondary subgroup will be automatically derived from the parent.
                    </Typography>
                    
                    <Autocomplete
                      options={parentOptions}
                      value={selectedParent}
                      onChange={handleParentChange}
                      onInputChange={(_event, newInputValue) => {
                        setParentSearchQuery(newInputValue);
                      }}
                      getOptionLabel={(option) => option.display_name}
                      loading={loadingParents}
                      disabled={!formData.level_glottolog}
                      autoHighlight
                      openOnFocus
                      clearOnEscape
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Parent Languoid"
                          placeholder={
                            !formData.level_glottolog 
                              ? "Select a level first..."
                              : formData.level_glottolog === 'dialect'
                              ? "Search for a language..."
                              : "Search for a family..."
                          }
                          error={!!errors.parent_languoid}
                          helperText={errors.parent_languoid || 'Optional - leave blank for top-level families'}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {loadingParents ? <CircularProgress size={20} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props} key={option.id}>
                          <Box>
                            <Typography variant="body2">{option.name}</Typography>
                            {option.glottocode && (
                              <Typography variant="caption" color="text.secondary">
                                {option.glottocode}
                              </Typography>
                            )}
                          </Box>
                        </li>
                      )}
                      isOptionEqualToValue={(option, value) => option.id === value?.id}
                    />
                  </Box>
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
                  <TextField
                    fullWidth
                    label="Region"
                    value={formData.region}
                    onChange={handleInputChange('region')}
                    error={!!errors.region}
                    helperText={errors.region}
                  />

                  <TextField
                    fullWidth
                    label="Tribes"
                    value={formData.tribes}
                    onChange={handleInputChange('tribes')}
                    error={!!errors.tribes}
                    helperText={errors.tribes}
                  />

                  <TextField
                    fullWidth
                    label="Dialects"
                    value={formData.dialects}
                    onChange={handleInputChange('dialects')}
                    multiline
                    rows={2}
                    error={!!errors.dialects}
                    helperText={errors.dialects}
                  />

                  <TextField
                    fullWidth
                    label="Notes"
                    value={formData.notes}
                    onChange={handleInputChange('notes')}
                    multiline
                    rows={3}
                    error={!!errors.notes}
                    helperText={errors.notes}
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
                  <TextField
                    fullWidth
                    label="Latitude"
                    value={formData.latitude}
                    onChange={handleInputChange('latitude')}
                    error={!!errors.latitude}
                    helperText={errors.latitude || 'Decimal degrees (e.g., 35.6762)'}
                    type="number"
                    inputProps={{ step: 'any' }}
                  />

                  <TextField
                    fullWidth
                    label="Longitude"
                    value={formData.longitude}
                    onChange={handleInputChange('longitude')}
                    error={!!errors.longitude}
                    helperText={errors.longitude || 'Decimal degrees (e.g., -97.4928)'}
                    type="number"
                    inputProps={{ step: 'any' }}
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Submit Actions */}
            <Card sx={{ elevation: 1 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting || glottocodeValidation.isValidating}
                    fullWidth
                  >
                    {submitting ? 'Creating...' : 'Create Languoid'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={handleBack}
                    disabled={submitting}
                    fullWidth
                  >
                    Cancel
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </form>
    </Container>
  );
};

export default LanguoidCreate;
