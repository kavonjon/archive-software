import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Autocomplete,
  TextField,
  Typography,
  Stack,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Check as CheckIcon } from '@mui/icons-material';
import { EditableField, EditableFieldProps } from './EditableField';
import { CollaboratorRole, CollaboratorRoleMutationData, Collaborator } from '../../services/api';
import { EditableMultiSelectField } from './EditableMultiSelectField';

export interface EditableCollaboratorRolesFieldProps extends Omit<EditableFieldProps, 'children' | 'value'> {
  itemId: number;  // Required to fetch/update collaborator roles
  value: CollaboratorRole[];  // Current collaborator roles
  roleChoicesEndpoint?: string;  // API endpoint for role choices (defaults to /internal/v1/collaborator-role-choices/)
  collaboratorSearchEndpoint?: string;  // API endpoint for searching collaborators (defaults to /internal/v1/collaborators/)
  onSave: (roles: CollaboratorRoleMutationData[]) => Promise<void>;  // Custom save handler
}

/**
 * EditableCollaboratorRolesField - Editable field for managing Item-Collaborator relationships with roles
 * 
 * This component handles the CollaboratorRole through-model, allowing users to:
 * - Add collaborators to an item
 * - Assign multiple roles to each collaborator
 * - Toggle citation_author status
 * - Remove collaborators from the item
 * 
 * Display mode shows chips with collaborator names and their roles.
 * Edit mode provides a searchable dropdown to add collaborators and role selectors for each.
 */
export const EditableCollaboratorRolesField: React.FC<EditableCollaboratorRolesFieldProps> = ({
  itemId,
  fieldName,
  label,
  value = [],
  roleChoicesEndpoint = '/internal/v1/collaborator-role-choices/',
  collaboratorSearchEndpoint = '/internal/v1/collaborators/',
  isEditing = false,
  isSaving = false,
  editValue,
  validationState,
  startEditing,
  saveField,
  cancelEditing,
  updateEditValue,
  onValueChange,
  onSave,
}) => {
  // State for edit mode
  const [editingRoles, setEditingRoles] = useState<Array<{
    collaborator: Collaborator;
    role: string[];
    citation_author: boolean;
  }>>([]);
  
  // Track the state when opening role selector for proper Escape handling
  const [roleStateOnOpen, setRoleStateOnOpen] = useState<Record<number, string[]>>({});
  
  // State for loading collaborator/role options
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [roleChoices, setRoleChoices] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [collaboratorSearchQuery, setCollaboratorSearchQuery] = useState('');

  // Initialize editing state when entering edit mode
  useEffect(() => {
    if (isEditing && value) {
      // Convert CollaboratorRole[] to editing format and sort alphabetically
      const initialRoles = value.map(role => ({
        collaborator: {
          id: role.collaborator_data.id,
          display_name: role.collaborator_data.display_name,
          full_name: role.collaborator_data.full_name,
          slug: role.collaborator_data.slug,
        } as Collaborator,
        role: role.role || [],
        citation_author: role.citation_author || false,
      })).sort((a, b) => {
        const nameA = a.collaborator.display_name || a.collaborator.full_name || '';
        const nameB = b.collaborator.display_name || b.collaborator.full_name || '';
        return nameA.localeCompare(nameB);
      });
      setEditingRoles(initialRoles);
    }
  }, [isEditing, value]);

  // Load role choices when entering edit mode
  const loadRoleChoices = useCallback(async () => {
    if (!isEditing) return;

    setLoadingRoles(true);
    try {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const response = await fetch(`${baseUrl}${roleChoicesEndpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch role choices');
      
      const data = await response.json();
      setRoleChoices(data);
    } catch (error) {
      console.error('Error loading role choices:', error);
      setRoleChoices([]);
    } finally {
      setLoadingRoles(false);
    }
  }, [isEditing, roleChoicesEndpoint]);

  // Load collaborators for search dropdown
  const loadCollaborators = useCallback(async (search: string = '') => {
    setLoadingCollaborators(true);
    try {
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
      const url = new URL(collaboratorSearchEndpoint, baseUrl || window.location.origin);
      
      if (search) {
        url.searchParams.append('search', search);
      }
      url.searchParams.append('page_size', '50');

      const response = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch collaborators');
      
      const data = await response.json();
      setCollaborators(data.results || data);
    } catch (error) {
      console.error('Error loading collaborators:', error);
      setCollaborators([]);
    } finally {
      setLoadingCollaborators(false);
    }
  }, [collaboratorSearchEndpoint]);

  // Load data when entering edit mode
  useEffect(() => {
    if (isEditing) {
      loadRoleChoices();
      loadCollaborators();
    }
  }, [isEditing, loadRoleChoices, loadCollaborators]);

  // Handle adding a collaborator
  const handleAddCollaborator = (collaborator: Collaborator | null) => {
    if (!collaborator) return;

    // Check if already added
    const exists = editingRoles.some(r => r.collaborator.id === collaborator.id);
    if (exists) {
      // Silently ignore - already filtered out but just in case
      return;
    }

    setEditingRoles(prev => {
      const newRoles = [
        ...prev,
        {
          collaborator,
          role: [],
          citation_author: false,
        },
      ];
      
      // Sort alphabetically by display name
      return newRoles.sort((a, b) => {
        const nameA = a.collaborator.display_name || a.collaborator.full_name || '';
        const nameB = b.collaborator.display_name || b.collaborator.full_name || '';
        return nameA.localeCompare(nameB);
      });
    });
    
    // Reset search query after adding
    setCollaboratorSearchQuery('');
    // Reload full list to show remaining collaborators
    loadCollaborators('');
  };

  // Handle removing a collaborator
  const handleRemoveCollaborator = (collaboratorId: number) => {
    setEditingRoles(prev => prev.filter(r => r.collaborator.id !== collaboratorId));
    // Reload collaborators list to include the removed collaborator
    if (collaboratorSearchQuery) {
      loadCollaborators(collaboratorSearchQuery);
    } else {
      loadCollaborators('');
    }
  };
  
  // Filter out already-added collaborators from the dropdown options
  const availableCollaborators = collaborators.filter(
    collab => !editingRoles.some(r => r.collaborator.id === collab.id)
  );

  // Handle updating roles for a collaborator
  const handleRolesChange = (collaboratorId: number, newRoles: string[]) => {
    setEditingRoles(prev =>
      prev.map(r =>
        r.collaborator.id === collaboratorId
          ? { ...r, role: newRoles }
          : r
      )
    );
  };

  // Handle updating citation_author for a collaborator
  const handleCitationAuthorChange = (collaboratorId: number, value: boolean) => {
    setEditingRoles(prev =>
      prev.map(r =>
        r.collaborator.id === collaboratorId
          ? { ...r, citation_author: value }
          : r
      )
    );
  };

  // Custom save handler
  const handleSave = async () => {
    try {
      // Convert to mutation format
      const mutationData: CollaboratorRoleMutationData[] = editingRoles.map(r => ({
        collaborator: r.collaborator.id,
        role: r.role,
        citation_author: r.citation_author,
      }));

      await onSave(mutationData);
    } catch (error) {
      console.error('Error saving collaborator roles:', error);
      throw error;
    }
  };

  // Custom start editing handler
  const handleStartEditing = () => {
    if (startEditing) {
      startEditing(fieldName, ''); // Pass empty string as placeholder
    }
  };

  // Display value as chips with collaborator names and roles
  const displayValue = value.length > 0 ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
      {value.map((collabRole) => {
        const roleLabels = collabRole.role_display.join(', ');
        const chipLabel = roleLabels
          ? `${collabRole.collaborator_data.display_name} (${roleLabels})`
          : collabRole.collaborator_data.display_name;

        return (
          <Chip
            key={collabRole.id}
            label={chipLabel}
            size="small"
            variant="outlined"
            color={collabRole.citation_author ? 'primary' : 'default'}
          />
        );
      })}
    </Box>
  ) : '(no collaborators)';

  return (
    <EditableField
      fieldName={fieldName}
      label={label}
      value={displayValue as any}
      isEditing={isEditing}
      isSaving={isSaving}
      editValue={editValue}
      validationState={validationState}
      startEditing={handleStartEditing}
      saveField={handleSave}
      cancelEditing={cancelEditing}
      updateEditValue={updateEditValue}
      onValueChange={onValueChange}
    >
      {isEditing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          {/* Add Collaborator Section */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Add Collaborator:
            </Typography>
            <Autocomplete
              options={availableCollaborators}
              getOptionLabel={(option) => option.display_name || option.full_name}
              loading={loadingCollaborators}
              inputValue={collaboratorSearchQuery}
              onInputChange={(event, value, reason) => {
                // Update search query
                setCollaboratorSearchQuery(value);
                // Load collaborators when user types (at least 2 characters)
                if (value.length >= 2) {
                  loadCollaborators(value);
                } else if (value.length === 0) {
                  // Load all when search is cleared
                  loadCollaborators('');
                }
              }}
              onChange={(event, value) => {
                handleAddCollaborator(value);
                // Input value will be cleared by handleAddCollaborator
              }}
              value={null}  // Always null to prevent showing selected value
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Search collaborators..."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingCollaborators ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              disabled={isSaving}
            />
          </Box>

          {/* Current Collaborators Section */}
          {editingRoles.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Current Collaborators:
              </Typography>
              <Stack spacing={2}>
                {editingRoles.map((collabRole) => (
                  <Box
                    key={collabRole.collaborator.id}
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {/* Collaborator name and remove button */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight="medium">
                        {collabRole.collaborator.display_name || collabRole.collaborator.full_name}
                      </Typography>
                      <Tooltip title="Remove collaborator">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveCollaborator(collabRole.collaborator.id)}
                          disabled={isSaving}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Role selector */}
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Roles:
                      </Typography>
                      <Autocomplete
                        multiple
                        options={roleChoices}
                        value={roleChoices.filter(opt => collabRole.role.includes(opt.value))}
                        onChange={(event, newValue) => {
                          const roleValues = newValue.map(opt => opt.value);
                          handleRolesChange(collabRole.collaborator.id, roleValues);
                        }}
                        onOpen={() => {
                          // Save the current state when opening, for potential Escape rollback
                          setRoleStateOnOpen(prev => ({
                            ...prev,
                            [collabRole.collaborator.id]: [...collabRole.role]
                          }));
                        }}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) => option.value === value.value}
                        disableCloseOnSelect
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            // Restore the state from when the dropdown was opened
                            const originalState = roleStateOnOpen[collabRole.collaborator.id];
                            if (originalState) {
                              handleRolesChange(collabRole.collaborator.id, originalState);
                            }
                            // Let MUI handle closing
                            return;
                          }
                          
                          // For Enter key: if no keyboard navigation, prevent MUI's default toggle behavior
                          if (event.key === 'Enter') {
                            const listbox = document.querySelector('[role="listbox"]');
                            const activeDescendant = listbox?.getAttribute('aria-activedescendant');
                            
                            // If no keyboard navigation, prevent MUI's internal Enter handling
                            if (!activeDescendant) {
                              // Use MUI's special property to prevent internal toggle behavior
                              (event as any).defaultMuiPrevented = true;
                              event.preventDefault();
                              event.stopPropagation();
                              
                              // Close the dropdown
                              (event.target as HTMLElement).blur();
                            }
                          }
                        }}
                        renderOption={(props, option, { selected }) => (
                          <li {...props}>
                            <Checkbox
                              icon={<CheckIcon sx={{ visibility: 'hidden' }} />}
                              checkedIcon={<CheckIcon />}
                              style={{ marginRight: 8 }}
                              checked={selected}
                            />
                            {option.label}
                          </li>
                        )}
                        renderTags={(tagValue, getTagProps) =>
                          tagValue.map((option, index) => (
                            <Chip
                              label={option.label}
                              size="small"
                              {...getTagProps({ index })}
                            />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            placeholder="Select roles..."
                          />
                        )}
                        disabled={isSaving || loadingRoles}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>

                    {/* Citation author checkbox */}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={collabRole.citation_author}
                          onChange={(e) =>
                            handleCitationAuthorChange(collabRole.collaborator.id, e.target.checked)
                          }
                          size="small"
                          disabled={isSaving}
                        />
                      }
                      label={<Typography variant="caption">Citation Author</Typography>}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {editingRoles.length === 0 && (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              No collaborators added yet. Search and select collaborators above.
            </Typography>
          )}
        </Box>
      )}
    </EditableField>
  );
};

