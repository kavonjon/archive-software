import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  Chip,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuList,
  MenuItem,
  ListItemText,
  CircularProgress,
  Typography,
  Autocomplete,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { SpreadsheetCell } from '../../types/spreadsheet';

interface CollaboratorWithRoles {
  id: number;
  name: string;
  roles: string[];
  citation_author: boolean;
}

interface CollaboratorOption {
  id: number;
  display_name: string;
  full_name: string;
}

interface RoleChoice {
  value: string;
  label: string;
}

interface CollaboratorRolesCellEditorProps {
  cell: SpreadsheetCell;
  onCommit: (result: { value: any; text: string }, moveFocus: boolean) => void;
  onCancel: () => void;
}

/**
 * Custom cell editor for managing Item-Collaborator relationships with roles.
 * 
 * This editor allows users to:
 * - Search and add collaborators
 * - Assign multiple roles to each collaborator
 * - Toggle citation_author status
 * - Remove collaborators
 * 
 * Display format: "Name (Role1, Role2) in citation, Name2 (Role3)"
 */
export const CollaboratorRolesCellEditor: React.FC<CollaboratorRolesCellEditorProps> = ({
  cell,
  onCommit,
  onCancel,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // State for collaborators being edited
  const [selectedCollaborators, setSelectedCollaborators] = useState<CollaboratorWithRoles[]>([]);
  
  // State for loading options
  const [collaboratorOptions, setCollaboratorOptions] = useState<CollaboratorOption[]>([]);
  const [roleChoices, setRoleChoices] = useState<RoleChoice[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track which collaborator has role selector open (by unique key, not id)
  const [openRoleSelector, setOpenRoleSelector] = useState<string | null>(null);
  
  // Track original roles when dropdown opens (for Escape to restore)
  const [rolesBeforeEdit, setRolesBeforeEdit] = useState<{ [key: string]: string[] }>({});

  // Initialize from cell value ONCE on mount
  useEffect(() => {
    if (cell.value && Array.isArray(cell.value)) {
      // Cell value format: [{id, name, roles: [...], citation_author: bool}, ...]
      // Mark each collaborator as valid (id !== null) or invalid (id === null)
      // For invalid collaborators, assign a unique temporary key for React rendering
      const withValidationFlags = cell.value.map((collab: any, idx: number) => ({
        ...collab,
        isValid: collab.id !== null && collab.id !== undefined,
        // Add a stable unique key for invalid collaborators (never collides with valid ids)
        _uniqueKey: collab.id !== null && collab.id !== undefined 
          ? `valid-${collab.id}` 
          : `invalid-${Date.now()}-${idx}-${collab.name}`,
      }));
      setSelectedCollaborators(withValidationFlags);
    }
    
    // The search TextField has autoFocus, so it will be focused automatically
    // No need to manually focus the container
  }, []); // Only run once on mount

  // Load collaborator options
  useEffect(() => {
    const loadCollaborators = async () => {
      setLoadingCollaborators(true);
      try {
        const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
        const url = `${baseUrl}/internal/v1/collaborators/?page_size=200`;
        
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        if (!response.ok) throw new Error('Failed to fetch collaborators');
        
        const data = await response.json();
        setCollaboratorOptions(data.results || data);
      } catch (error) {
        console.error('Error loading collaborators:', error);
      } finally {
        setLoadingCollaborators(false);
      }
    };
    
    loadCollaborators();
  }, []);

  // Load role choices
  useEffect(() => {
    const loadRoleChoices = async () => {
      setLoadingRoles(true);
      try {
        const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
        const url = `${baseUrl}/internal/v1/collaborator-role-choices/`;
        
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        if (!response.ok) throw new Error('Failed to fetch role choices');
        
        const data = await response.json();
        // API returns array of {value, label} objects
        setRoleChoices(data);
      } catch (error) {
        console.error('Error loading role choices:', error);
      } finally {
        setLoadingRoles(false);
      }
    };
    
    loadRoleChoices();
  }, []);

  // Handle adding a collaborator
  const handleAddCollaborator = (collaborator: CollaboratorOption) => {
    // Check if already added
    if (selectedCollaborators.some(c => c.id === collaborator.id)) {
      return;
    }
    
    const newCollab: CollaboratorWithRoles & { _uniqueKey: string; isValid: boolean } = {
      id: collaborator.id,
      name: collaborator.display_name || collaborator.full_name,
      roles: [],
      citation_author: false,
      _uniqueKey: `valid-${collaborator.id}`,  // Newly added collaborators are always valid
      isValid: true,
    };
    
    setSelectedCollaborators(prev => {
      const updated = [...prev, newCollab];
      // Sort alphabetically by name
      return updated.sort((a, b) => a.name.localeCompare(b.name));
    });
    
    setSearchQuery('');
  };

  // Handle removing a collaborator
  const handleRemoveCollaborator = (index: number) => {
    setSelectedCollaborators(prev => prev.filter((_, i) => i !== index));
    // Refocus search input to maintain focus in editor
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  // Handle updating roles for a collaborator
  const handleRolesChange = (index: number, newRoles: string[]) => {
    setSelectedCollaborators(prev =>
      prev.map((c, i) =>
        i === index ? { ...c, roles: newRoles } : c
      )
    );
  };

  // Handle updating citation_author for a collaborator
  const handleCitationAuthorChange = (index: number, value: boolean) => {
    setSelectedCollaborators(prev =>
      prev.map((c, i) =>
        i === index ? { ...c, citation_author: value } : c
      )
    );
    // Refocus search input to maintain focus in editor
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  // Use ref to always have current value of selectedCollaborators
  const selectedCollaboratorsRef = useRef(selectedCollaborators);
  useEffect(() => {
    selectedCollaboratorsRef.current = selectedCollaborators;
  }, [selectedCollaborators]);

  // Handle commit
  const handleCommit = useCallback(() => {
    const currentCollaborators = selectedCollaboratorsRef.current;
    const originalValue = cell.value || [];
    
    // Separate original collaborators into valid and invalid
    const originalValidCollaborators = Array.isArray(originalValue)
      ? originalValue.filter((collab: any) => collab && collab.id !== null && collab.id !== undefined)
      : [];
    
    const originalInvalidCollaborators = Array.isArray(originalValue)
      ? originalValue.filter((collab: any) => collab && (collab.id === null || collab.id === undefined))
      : [];
    
    // Separate current collaborators into valid and invalid
    const currentValidCollaborators = currentCollaborators.filter((collab: any) => 
      collab && collab.id !== null && collab.id !== undefined
    );
    
    const currentInvalidCollaborators = currentCollaborators.filter((collab: any) => 
      collab && (collab.id === null || collab.id === undefined)
    );
    
    // Check if user made ANY changes
    let hasChanges = false;
    
    // 1. Check if invalid collaborators were removed
    if (originalInvalidCollaborators.length > currentInvalidCollaborators.length) {
      hasChanges = true;
    }
    
    // 2. Check if valid collaborators were added/removed
    const currentValidIds = currentValidCollaborators.map((c: any) => c.id).sort();
    const originalValidIds = originalValidCollaborators.map((c: any) => c.id).sort();
    
    if (currentValidIds.length !== originalValidIds.length ||
        !currentValidIds.every((id, idx) => id === originalValidIds[idx])) {
      hasChanges = true;
    }
    
    // 3. Check if roles or citation_author changed for valid collaborators
    if (!hasChanges && currentValidIds.length === originalValidIds.length) {
      for (const current of currentValidCollaborators) {
        const original = originalValidCollaborators.find((o: any) => o.id === current.id);
        if (original) {
          // Check roles
          const currentRolesSorted = [...current.roles].sort().join(',');
          const originalRolesSorted = [...original.roles].sort().join(',');
          if (currentRolesSorted !== originalRolesSorted) {
            hasChanges = true;
            break;
          }
          // Check citation_author
          if (current.citation_author !== original.citation_author) {
            hasChanges = true;
            break;
          }
        }
      }
    }
    
    // 4. Check if roles or citation_author changed for invalid collaborators
    if (!hasChanges) {
      for (let i = 0; i < currentInvalidCollaborators.length; i++) {
        const current = currentInvalidCollaborators[i];
        const original = originalInvalidCollaborators[i]; // Match by position (same name)
        
        if (original && current.name === original.name) {
          // Check roles
          const currentRolesSorted = [...current.roles].sort().join(',');
          const originalRolesSorted = [...original.roles].sort().join(',');
          if (currentRolesSorted !== originalRolesSorted) {
            hasChanges = true;
            break;
          }
          // Check citation_author
          if (current.citation_author !== original.citation_author) {
            hasChanges = true;
            break;
          }
        }
      }
    }
    
    // If no changes were made, cancel
    if (!hasChanges) {
      onCancel();
      return;
    }
    
    // Changes were made - commit them
    // Format display text: "Name (role, role; in citation), Name (role, role), Name (in citation), Name"
    const text = currentCollaborators.map((collab: any) => {
      const hasRoles = collab.roles.length > 0;
      const isCitation = collab.citation_author;
      
      // Convert role values to human-readable labels
      const roleLabels = collab.roles.map((roleValue: string) => {
        const roleChoice = roleChoices.find(rc => rc.value === roleValue);
        return roleChoice ? roleChoice.label : roleValue;
      });
      
      if (hasRoles && isCitation) {
        // Name (Role Label, Role Label; in citation)
        return `${collab.name} (${roleLabels.join(', ')}; in citation)`;
      } else if (hasRoles && !isCitation) {
        // Name (Role Label, Role Label)
        return `${collab.name} (${roleLabels.join(', ')})`;
      } else if (!hasRoles && isCitation) {
        // Name (in citation)
        return `${collab.name} (in citation)`;
      } else {
        // Name
        return collab.name;
      }
    }).join(', ');
    
    console.log('[CollaboratorRolesCellEditor] handleCommit - value:', currentCollaborators);
    console.log('[CollaboratorRolesCellEditor] handleCommit - text:', text);
    
    onCommit({ value: currentCollaborators, text }, true);
  }, [onCommit, roleChoices, cell.value, onCancel]);

  // Handle blur on the editor container
  // This catches clicks on blank areas that don't have their own focusable elements
  const handleContainerBlur = (e: React.FocusEvent) => {
    // Check where focus is moving to
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    
    // If focus is moving to an element inside our editor, don't commit
    if (relatedTarget && editorRef.current?.contains(relatedTarget)) {
      return;
    }
    
    // Focus is moving outside the editor, commit changes
    handleCommit();
  };

  // Handle blur on the search input
  // Check if focus is moving outside the editor container
  const handleBlur = (e: React.FocusEvent) => {
    // Check where focus is moving to
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    
    // If focus is moving to an element inside our editor, don't commit
    if (relatedTarget && editorRef.current?.contains(relatedTarget)) {
      return;
    }
    
    // Focus is moving outside the editor, commit changes
    handleCommit();
  };

  // Handle keyboard shortcuts on search input
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Enter' && !openRoleSelector) {
      // Only commit on Enter if role selector isn't open
      // (to avoid committing when selecting a role)
      e.preventDefault();
      e.stopPropagation();
      handleCommit();
    }
  };

  // Filter out already-selected collaborators
  const availableCollaborators = collaboratorOptions.filter(
    opt => !selectedCollaborators.some(c => c.id === opt.id)
  );

  return (
    <div
      ref={editorRef}
      tabIndex={0}
      onBlur={handleContainerBlur}
      style={{
        width: '100%',
        minHeight: 200,
        maxHeight: 500,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        border: '2px solid #1976d2',
        borderRadius: 4,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        outline: 'none', // Remove focus outline since we have a visible border
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search input to add collaborators */}
      <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0' }}>
        <Autocomplete
          options={availableCollaborators}
          getOptionLabel={(option) => option.display_name || option.full_name}
          inputValue={searchQuery}
          onInputChange={(_, newValue) => setSearchQuery(newValue)}
          onChange={(_, newValue) => {
            if (newValue) {
              handleAddCollaborator(newValue);
            }
          }}
          loading={loadingCollaborators}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={searchInputRef}
              placeholder="Search collaborators..."
              variant="outlined"
              size="small"
              autoFocus
              onBlur={handleBlur}
              onKeyDown={handleSearchKeyDown}
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
        />
      </Box>

      {/* List of selected collaborators */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {selectedCollaborators.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            No collaborators selected. Search above to add.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {selectedCollaborators.map((collab: any, index: number) => {
              // Use the stable unique key we assigned during initialization
              const uniqueKey = collab._uniqueKey || `fallback-${index}`;
              
              return (
              <Box
                key={uniqueKey}
                sx={{
                  p: 1.5,
                  border: collab.isValid === false ? '2px solid #f44336' : '1px solid #e0e0e0',
                  borderRadius: 1,
                  backgroundColor: collab.isValid === false ? '#ffebee' : '#f9f9f9',
                }}
              >
                {/* Collaborator name and remove button */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: collab.isValid === false ? '#f44336' : 'inherit'
                    }}
                  >
                    {collab.name}
                    {collab.isValid === false && (
                      <Typography component="span" variant="caption" sx={{ ml: 1, color: '#f44336' }}>
                        (Not found in database)
                      </Typography>
                    )}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCollaborator(index);
                    }}
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Roles multiselect */}
                <Box sx={{ mb: 1 }}>
                  <Autocomplete
                    multiple
                    open={openRoleSelector === uniqueKey}
                    options={roleChoices}
                    getOptionLabel={(option) => option.label}
                    value={roleChoices.filter(rc => collab.roles.includes(rc.value))}
                    onChange={(_, newValue) => {
                      handleRolesChange(index, newValue.map(v => v.value));
                    }}
                    onOpen={() => {
                      // Save original roles for potential Escape restoration
                      setRolesBeforeEdit(prev => ({
                        ...prev,
                        [uniqueKey]: [...collab.roles]
                      }));
                      setOpenRoleSelector(uniqueKey);
                    }}
                    onClose={(_, reason) => {
                      // If closed by Escape, restore original roles
                      if (reason === 'escape' && rolesBeforeEdit[uniqueKey]) {
                        handleRolesChange(index, rolesBeforeEdit[uniqueKey]);
                      }
                      
                      setOpenRoleSelector(null);
                      // Refocus the search input to maintain focus within editor
                      // This ensures blur/keyboard events still work after closing roles dropdown
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 0);
                    }}
                    loading={loadingRoles}
                    size="small"
                    disableCloseOnSelect
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select roles..."
                        variant="outlined"
                        size="small"
                        label="Roles"
                        onKeyDown={(e) => {
                          // Enter closes the dropdown (keeps changes)
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenRoleSelector(null);
                            // Refocus search input
                            setTimeout(() => {
                              searchInputRef.current?.focus();
                            }, 0);
                          }
                        }}
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option.value}
                          label={option.label}
                          size="small"
                        />
                      ))
                    }
                  />
                </Box>

                {/* Citation author checkbox */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={collab.citation_author}
                      onChange={(e) => handleCitationAuthorChange(index, e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Citation author</Typography>}
                />
              </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Footer with instructions */}
      <Box
        sx={{
          p: 1,
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Press Enter to save, Esc to cancel
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {selectedCollaborators.length} selected
        </Typography>
      </Box>
    </div>
  );
};

