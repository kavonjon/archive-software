import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
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
  IconButton,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Container,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { collaboratorsAPI, type Collaborator } from '../../services/api';
import { DateFormatHelp } from '../common';

interface CollaboratorFormData {
  // Core identity fields
  collaborator_id: string;
  name: string;
  firstname: string;
  lastname: string;
  nickname: string;
  other_names: string;
  
  // Privacy
  anonymous: boolean | null;
  
  // Cultural information
  clan_society: string;
  tribal_affiliations: string;
  origin: string;
  gender: string;
  
  // Dates (flexible text fields)
  birthdate: string;
  deathdate: string;
  
  // Additional information
  other_info: string;
}

interface CollaboratorCreateProps {
  onSuccess?: (collaborator: Collaborator) => void;
  onCancel?: () => void;
}

const CollaboratorCreate: React.FC<CollaboratorCreateProps> = ({
  onSuccess,
  onCancel,
}) => {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState<CollaboratorFormData>({
    // Core identity fields
    collaborator_id: '',
    name: '',
    firstname: '',
    lastname: '',
    nickname: '',
    other_names: '',
    
    // Privacy
    anonymous: null,
    
    // Cultural information
    clan_society: '',
    tribal_affiliations: '',
    origin: '',
    gender: '',
    
    // Dates
    birthdate: '',
    deathdate: '',
    
    // Additional information
    other_info: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDateHelp, setShowDateHelp] = useState<{ [key: string]: boolean }>({});

  // Collaborator ID validation state
  const [collaboratorIdValidation, setCollaboratorIdValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  // Auto-generate next collaborator ID on component mount
  useEffect(() => {
    const generateNextId = async () => {
      try {
        // Get the highest collaborator ID and add 1
        const response = await collaboratorsAPI.list({ 
          ordering: '-collaborator_id',
          page_size: 1 
        });
        
        let nextId = 1;
        if (response.results.length > 0) {
          nextId = response.results[0].collaborator_id + 1;
        }
        
        setFormData(prev => ({ ...prev, collaborator_id: nextId.toString() }));
      } catch (err) {
        console.error('Error generating next collaborator ID:', err);
        // Default to empty if we can't generate
      }
    };

    generateNextId();
  }, []);

  // Debounced collaborator ID validation
  const validateCollaboratorId = useMemo(
    () => debounce(async (value: string) => {
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

  // Handle form field changes
  const handleFieldChange = (field: keyof CollaboratorFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Trigger validation for collaborator_id
    if (field === 'collaborator_id') {
      validateCollaboratorId(value);
    }
  };

  // Handle select field changes
  const handleSelectChange = (field: keyof CollaboratorFormData) => (
    event: any
  ) => {
    const value = event.target.value === '' ? null : event.target.value === 'true';
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Basic validation
    if (!formData.collaborator_id.trim()) {
      setError('Collaborator ID is required');
      return;
    }

    if (!collaboratorIdValidation.isValid || collaboratorIdValidation.isValidating) {
      setError('Please fix validation errors before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare data for submission
      const submitData: Partial<Collaborator> = {
        collaborator_id: parseInt(formData.collaborator_id, 10),
        name: formData.name.trim() || undefined,
        firstname: formData.firstname.trim() || undefined,
        lastname: formData.lastname.trim() || undefined,
        nickname: formData.nickname.trim() || undefined,
        other_names: formData.other_names.trim() || undefined,
        anonymous: formData.anonymous,
        clan_society: formData.clan_society.trim() || undefined,
        tribal_affiliations: formData.tribal_affiliations.trim() || undefined,
        origin: formData.origin.trim() || undefined,
        gender: formData.gender.trim() || undefined,
        birthdate: formData.birthdate.trim() || undefined,
        deathdate: formData.deathdate.trim() || undefined,
        other_info: formData.other_info.trim() || undefined,
      };

      const newCollaborator = await collaboratorsAPI.create(submitData);
      
      if (onSuccess) {
        onSuccess(newCollaborator);
      } else {
        navigate(`/collaborators/${newCollaborator.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create collaborator');
      console.error('Error creating collaborator:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/collaborators');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/collaborators');
  };

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
                Add New Collaborator
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
            {/* Left Column */}
            <Box>
              {/* Basic Information */}
              <Card sx={{ mb: 3, elevation: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                    Basic Information
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Stack spacing={3}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label="Collaborator ID"
                        value={formData.collaborator_id}
                        onChange={handleFieldChange('collaborator_id')}
                        required
                        fullWidth
                        error={!!collaboratorIdValidation.error}
                        helperText={
                          collaboratorIdValidation.isValidating 
                            ? 'Checking uniqueness...' 
                            : collaboratorIdValidation.error || 'Unique identifier for this collaborator'
                        }
                        InputProps={{
                          endAdornment: collaboratorIdValidation.isValidating ? (
                            <CircularProgress size={20} />
                          ) : null,
                        }}
                      />
                      <FormControl fullWidth>
                        <InputLabel>Anonymous</InputLabel>
                        <Select
                          value={formData.anonymous === null ? '' : formData.anonymous.toString()}
                          onChange={handleSelectChange('anonymous')}
                          label="Anonymous"
                        >
                          <MenuItem value="">Not specified</MenuItem>
                          <MenuItem value="false">No</MenuItem>
                          <MenuItem value="true">Yes</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <TextField
                      label="Full Name"
                      value={formData.name}
                      onChange={handleFieldChange('name')}
                      fullWidth
                      helperText="Complete name as it should appear"
                    />
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label="First Name"
                        value={formData.firstname}
                        onChange={handleFieldChange('firstname')}
                        fullWidth
                      />
                      <TextField
                        label="Last Name"
                        value={formData.lastname}
                        onChange={handleFieldChange('lastname')}
                        fullWidth
                      />
                    </Box>
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label="Nickname"
                        value={formData.nickname}
                        onChange={handleFieldChange('nickname')}
                        fullWidth
                      />
                      <TextField
                        label="Other Names"
                        value={formData.other_names}
                        onChange={handleFieldChange('other_names')}
                        fullWidth
                        helperText="Alternative names or spellings"
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Cultural Information */}
              <Card sx={{ mb: 3, elevation: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                    Cultural Information
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Stack spacing={3}>
                    <TextField
                      label="Tribal Affiliations"
                      value={formData.tribal_affiliations}
                      onChange={handleFieldChange('tribal_affiliations')}
                      fullWidth
                      helperText="Tribal or community affiliations"
                    />
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label="Clan or Society"
                        value={formData.clan_society}
                        onChange={handleFieldChange('clan_society')}
                        fullWidth
                      />
                      <TextField
                        label="Place of Origin"
                        value={formData.origin}
                        onChange={handleFieldChange('origin')}
                        fullWidth
                      />
                    </Box>
                    
                    <TextField
                      label="Gender"
                      value={formData.gender}
                      onChange={handleFieldChange('gender')}
                      fullWidth
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Important Dates */}
              <Card sx={{ mb: 3, elevation: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                    Important Dates
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <TextField
                        label="Date of Birth"
                        value={formData.birthdate}
                        onChange={handleFieldChange('birthdate')}
                        fullWidth
                        onFocus={() => setShowDateHelp(prev => ({ ...prev, birthdate: true }))}
                        onBlur={() => setShowDateHelp(prev => ({ ...prev, birthdate: false }))}
                        helperText="Flexible date format accepted"
                      />
                      {showDateHelp.birthdate && <DateFormatHelp />}
                    </Box>
                    <Box>
                      <TextField
                        label="Date of Death"
                        value={formData.deathdate}
                        onChange={handleFieldChange('deathdate')}
                        fullWidth
                        onFocus={() => setShowDateHelp(prev => ({ ...prev, deathdate: true }))}
                        onBlur={() => setShowDateHelp(prev => ({ ...prev, deathdate: false }))}
                        helperText="Flexible date format accepted"
                      />
                      {showDateHelp.deathdate && <DateFormatHelp />}
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Additional Information */}
              <Card sx={{ mb: 3, elevation: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                    Additional Information
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <TextField
                    label="Other Information"
                    value={formData.other_info}
                    onChange={handleFieldChange('other_info')}
                    fullWidth
                    multiline
                    rows={4}
                    helperText="Any additional notes or information about this collaborator"
                  />
                </CardContent>
              </Card>
            </Box>

            {/* Right Column - Actions */}
            <Box>
              <Card sx={{ position: 'sticky', top: 20, elevation: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'primary.main', mb: 2 }}>
                    Actions
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Stack spacing={2}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                      disabled={loading || !collaboratorIdValidation.isValid || collaboratorIdValidation.isValidating}
                      fullWidth
                      size="large"
                    >
                      {loading ? 'Creating...' : 'Create Collaborator'}
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                      disabled={loading}
                      fullWidth
                    >
                      Cancel
                    </Button>
                  </Stack>

                  {/* Form Status */}
                  <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Form Status
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Collaborator ID:</Typography>
                        <Typography variant="body2" color={
                          collaboratorIdValidation.isValid ? 'success.main' : 'error.main'
                        }>
                          {collaboratorIdValidation.isValidating 
                            ? 'Validating...' 
                            : collaboratorIdValidation.isValid ? 'Valid' : 'Invalid'
                          }
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </form>
      </Box>
    </Container>
  );
};

export default CollaboratorCreate;
