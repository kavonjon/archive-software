import React, { useState, useMemo } from 'react';
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { languoidsAPI, LANGUOID_LEVEL_CHOICES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasEditAccess } from '../../utils/permissions';

interface FormData {
  name: string;
  iso: string;
  glottocode: string;
  level: string;
  alt_name: string;
  alt_names: string;
  family: string;
  family_id: string;
  family_abbrev: string;
  pri_subgroup: string;
  pri_subgroup_id: string;
  pri_subgroup_abbrev: string;
  sec_subgroup: string;
  sec_subgroup_id: string;
  sec_subgroup_abbrev: string;
  language: string;
  language_id: string;
  region: string;
  latitude: string;
  longitude: string;
  dialects: string;
  dialects_ids: string;
  tribes: string;
  notes: string;
}

const initialFormData: FormData = {
  name: '',
  iso: '',
  glottocode: '',
  level: '',
  alt_name: '',
  alt_names: '',
  family: '',
  family_id: '',
  family_abbrev: '',
  pri_subgroup: '',
  pri_subgroup_id: '',
  pri_subgroup_abbrev: '',
  sec_subgroup: '',
  sec_subgroup_id: '',
  sec_subgroup_abbrev: '',
  language: '',
  language_id: '',
  region: '',
  latitude: '',
  longitude: '',
  dialects: '',
  dialects_ids: '',
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.level) {
      newErrors.level = 'Level is required';
    }

    // Glottocode format validation
    if (formData.glottocode && (formData.glottocode.length !== 8 || !formData.glottocode.slice(-4).match(/^\d{4}$/))) {
      newErrors.glottocode = 'Glottocode must be 8 characters with the last 4 being numeric';
    }

    // Check glottocode validation state
    if (formData.glottocode && (!glottocodeValidation.isValid || glottocodeValidation.isValidating)) {
      newErrors.glottocode = glottocodeValidation.error || 'Glottocode validation in progress';
    }

    // Validate numeric fields
    if (formData.latitude && isNaN(parseFloat(formData.latitude))) {
      newErrors.latitude = 'Latitude must be a valid number';
    }
    if (formData.longitude && isNaN(parseFloat(formData.longitude))) {
      newErrors.longitude = 'Longitude must be a valid number';
    }

    // Validate glottocode format for related fields
    const glottocodeFields = ['family_id', 'pri_subgroup_id', 'sec_subgroup_id', 'language_id'];
    glottocodeFields.forEach(field => {
      const value = formData[field as keyof FormData];
      if (value && (value.length !== 8 || !value.slice(-4).match(/^\d{4}$/))) {
        newErrors[field] = 'Must be 8 characters with the last 4 being numeric';
      }
    });

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

      // Remove empty string values
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          delete submitData[key];
        }
      });

      const newLanguoid = await languoidsAPI.create(submitData);
      navigate(`/languages/${newLanguoid.id}`);
    } catch (error) {
      console.error('Error creating languoid:', error);
      setSubmitError('Failed to create languoid. Please check your input and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('/languages');
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

                  <FormControl fullWidth required error={!!errors.level}>
                    <InputLabel>Level</InputLabel>
                    <Select
                      value={formData.level}
                      label="Level"
                      onChange={handleInputChange('level')}
                    >
                      {LANGUOID_LEVEL_CHOICES.map((choice) => (
                        <MenuItem key={choice.value} value={choice.value}>
                          {choice.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.level && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {errors.level}
                      </Typography>
                    )}
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Alternate Name"
                    value={formData.alt_name}
                    onChange={handleInputChange('alt_name')}
                    error={!!errors.alt_name}
                    helperText={errors.alt_name}
                  />

                  <TextField
                    fullWidth
                    label="Alternate Names"
                    value={formData.alt_names}
                    onChange={handleInputChange('alt_names')}
                    multiline
                    rows={2}
                    error={!!errors.alt_names}
                    helperText={errors.alt_names}
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
                  <TextField
                    fullWidth
                    label="Family"
                    value={formData.family}
                    onChange={handleInputChange('family')}
                    error={!!errors.family}
                    helperText={errors.family}
                  />

                  <TextField
                    fullWidth
                    label="Family Glottocode"
                    value={formData.family_id}
                    onChange={handleInputChange('family_id')}
                    error={!!errors.family_id}
                    helperText={errors.family_id || 'Format: 8 characters, last 4 numeric'}
                  />

                  <TextField
                    fullWidth
                    label="Primary Subgroup"
                    value={formData.pri_subgroup}
                    onChange={handleInputChange('pri_subgroup')}
                    error={!!errors.pri_subgroup}
                    helperText={errors.pri_subgroup}
                  />

                  <TextField
                    fullWidth
                    label="Primary Subgroup Glottocode"
                    value={formData.pri_subgroup_id}
                    onChange={handleInputChange('pri_subgroup_id')}
                    error={!!errors.pri_subgroup_id}
                    helperText={errors.pri_subgroup_id || 'Format: 8 characters, last 4 numeric'}
                  />

                  <TextField
                    fullWidth
                    label="Secondary Subgroup"
                    value={formData.sec_subgroup}
                    onChange={handleInputChange('sec_subgroup')}
                    error={!!errors.sec_subgroup}
                    helperText={errors.sec_subgroup}
                  />

                  <TextField
                    fullWidth
                    label="Secondary Subgroup Glottocode"
                    value={formData.sec_subgroup_id}
                    onChange={handleInputChange('sec_subgroup_id')}
                    error={!!errors.sec_subgroup_id}
                    helperText={errors.sec_subgroup_id || 'Format: 8 characters, last 4 numeric'}
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
