import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { debounce } from 'lodash';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Typography,
  Chip,
  Collapse,
  Alert,
  CircularProgress,
  Checkbox,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collaboratorsAPI, Collaborator, PaginatedResponse, APIError } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasEditAccess } from '../../utils/permissions';

interface CollaboratorsListProps {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedCollaborators: Collaborator[]) => void;
}

interface FilterState {
  first_names_contains: string;
  last_names_contains: string;
  full_name_contains: string;
  collaborator_id_contains: string;
  tribal_affiliations_contains: string;
  native_languages_contains: string;
  other_languages_contains: string;
  anonymous: string;
  gender_contains: string;
  // Empty filters (isnull lookups)
  first_names_isnull?: boolean;
  nickname_isnull?: boolean;
  last_names_isnull?: boolean;
  name_suffix_isnull?: boolean;
  tribal_affiliations_isnull?: boolean;
  native_languages_isnull?: boolean;
  other_languages_isnull?: boolean;
  other_names_isnull?: boolean;
  gender_isnull?: boolean;
  birthdate_isnull?: boolean;
  deathdate_isnull?: boolean;
}

const CollaboratorsList: React.FC<CollaboratorsListProps> = ({
  showActions = true,
  selectable = false,
  onSelectionChange,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { state: authState } = useAuth();
  
  // Refs for focus management
  const tableRef = useRef<HTMLTableElement>(null);
  
  // State management
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<Collaborator[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    first_names_contains: '',
    last_names_contains: '',
    full_name_contains: '',
    collaborator_id_contains: '',
    tribal_affiliations_contains: '',
    native_languages_contains: '',
    other_languages_contains: '',
    anonymous: '',
    gender_contains: '',
  });

  // Active filters state - these are the filters actually applied to the API
  const [activeFilters, setActiveFilters] = useState<FilterState>(filters);

  // Load collaborators data
  const loadCollaborators = useCallback(async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentPage = resetPage ? 0 : page;
      
      // Build query parameters
      const params: Record<string, string | number | boolean> = {
        page: currentPage + 1, // API uses 1-based pagination
        page_size: rowsPerPage,
        ordering: 'last_names,first_names,full_name,collaborator_id', // Explicit ordering by last name
      };
      
      // Add non-empty filters
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          // Add boolean filters (isnull lookups)
          params[key] = value;
        } else if (typeof value === 'string' && value.trim()) {
          // Add string filters (contains lookups)
          params[key] = value.trim();
        }
      });
      
      const response = await collaboratorsAPI.list(params);
      
      setCollaborators(response.results);
      setTotalCount(response.count);
      
      if (resetPage) {
        setPage(0);
      }
      
      setInitialLoadComplete(true);
      
    } catch (err) {
      const apiError = err as APIError;
      setError(apiError.message || 'Failed to load collaborators');
      console.error('Error loading collaborators:', err);
      setInitialLoadComplete(true);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, activeFilters]);

  // Debounced filter application - automatically applies filters after user stops typing
  const debouncedApplyFilters = useMemo(
    () => debounce((newFilters: FilterState) => {
      setActiveFilters(newFilters);
      setPage(0); // Reset to first page when filters change
    }, 500),
    []
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedApplyFilters.cancel();
    };
  }, [debouncedApplyFilters]);

  // Load data on component mount and when dependencies change
  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  // Handle page change
  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  // Handle filter changes with debounced API call
  const handleFilterChange = (field: keyof FilterState) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newFilters = {
      ...filters,
      [field]: event.target.value
    };
    setFilters(newFilters);
    
    // Debounced API call - waits 500ms after user stops typing
    debouncedApplyFilters(newFilters);
  };

  // Handle empty filter toggle (isnull lookups)
  const handleEmptyFilterToggle = (field: keyof FilterState) => {
    const currentValue = filters[field];
    const newValue = currentValue === true ? undefined : true;
    
    const newFilters = {
      ...filters,
      [field]: newValue
    };
    setFilters(newFilters);
    
    // Immediately apply (no need for debounce on button clicks)
    debouncedApplyFilters.cancel();
    setActiveFilters(newFilters);
    setPage(0);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    const clearedFilters: FilterState = {
      first_names_contains: '',
      last_names_contains: '',
      full_name_contains: '',
      collaborator_id_contains: '',
      tribal_affiliations_contains: '',
      native_languages_contains: '',
      other_languages_contains: '',
      anonymous: '',
      gender_contains: '',
    };
    
    setFilters(clearedFilters);
    debouncedApplyFilters.cancel(); // Cancel any pending debounced calls
    setActiveFilters(clearedFilters); // Immediately apply cleared filters
    setPage(0);
  };

  // Handle collaborator selection
  const handleCollaboratorSelect = (collaborator: Collaborator, checked: boolean) => {
    const newSelected = checked
      ? [...selectedCollaborators, collaborator]
      : selectedCollaborators.filter(c => c.id !== collaborator.id);
    
    setSelectedCollaborators(newSelected);
    onSelectionChange?.(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    const newSelected = checked ? [...collaborators] : [];
    setSelectedCollaborators(newSelected);
    onSelectionChange?.(newSelected);
  };

  // Handle row click (navigate to detail)
  const handleRowClick = (collaborator: Collaborator) => {
    if (!selectable) {
      navigate(`/collaborators/${collaborator.id}`);
    }
  };

  // Handle create new collaborator
  const handleCreateNew = () => {
    navigate('/collaborators/create');
  };

  // Check if any filters are active
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (typeof value === 'boolean') return value === true;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  });

  // Count active filters for display
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (typeof value === 'boolean') return value === true;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  }).length;

  // Selection state
  const isAllSelected = collaborators.length > 0 && selectedCollaborators.length === collaborators.length;
  const isIndeterminate = selectedCollaborators.length > 0 && selectedCollaborators.length < collaborators.length;

  // Show full-page loading only on initial load, not on subsequent filter/pagination changes
  if (!initialLoadComplete) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading collaborators...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Collaborators
        </Typography>
        {showActions && hasEditAccess(authState.user) && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateNew}
            sx={{ minWidth: 'auto' }}
          >
            {isMobile ? 'Add' : 'Add Collaborator'}
          </Button>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          {hasActiveFilters && (
            <>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              color="secondary"
            >
              Clear Filters
            </Button>
              <Chip 
                icon={<FilterListIcon />}
                label={`${activeFilterCount} active filter${activeFilterCount !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
              />
            </>
          )}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Searching...
              </Typography>
            </Box>
          )}
        </Box>

        {/* Filter Fields */}
        <Collapse in={showFilters}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
            Filters apply automatically as you type
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            <TextField
              label="First Name Contains"
              value={filters.first_names_contains}
              onChange={handleFilterChange('first_names_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Last Name Contains"
              value={filters.last_names_contains}
              onChange={handleFilterChange('last_names_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Full Name Contains"
              value={filters.full_name_contains}
              onChange={handleFilterChange('full_name_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Collaborator ID"
              value={filters.collaborator_id_contains}
              onChange={handleFilterChange('collaborator_id_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Tribal Affiliations"
              value={filters.tribal_affiliations_contains}
              onChange={handleFilterChange('tribal_affiliations_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Native Languages"
              value={filters.native_languages_contains}
              onChange={handleFilterChange('native_languages_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Other Languages"
              value={filters.other_languages_contains}
              onChange={handleFilterChange('other_languages_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Gender"
              value={filters.gender_contains}
              onChange={handleFilterChange('gender_contains')}
              size="small"
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="anonymous-filter-label">Anonymous Status</InputLabel>
              <Select
                labelId="anonymous-filter-label"
                id="anonymous-filter"
                value={filters.anonymous}
                label="Anonymous Status"
                onChange={(e) => {
                  const newFilters = {
                    ...filters,
                    anonymous: e.target.value
                  };
                  setFilters(newFilters);
                  debouncedApplyFilters(newFilters);
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Anonymous Only</MenuItem>
                <MenuItem value="false">Non-Anonymous Only</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Empty Value Filters */}
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
              Find Records With Empty Values:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant={filters.first_names_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.first_names_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('first_names_isnull')}
              >
                First Name(s): Empty
              </Button>
              <Button
                variant={filters.nickname_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.nickname_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('nickname_isnull')}
              >
                Nickname: Empty
              </Button>
              <Button
                variant={filters.last_names_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.last_names_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('last_names_isnull')}
              >
                Last Name(s): Empty
              </Button>
              <Button
                variant={filters.name_suffix_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.name_suffix_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('name_suffix_isnull')}
              >
                Suffix: Empty
              </Button>
              <Button
                variant={filters.other_names_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.other_names_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('other_names_isnull')}
              >
                Other Names: Empty
              </Button>
              <Button
                variant={filters.tribal_affiliations_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.tribal_affiliations_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('tribal_affiliations_isnull')}
              >
                Tribal Affiliations: Empty
              </Button>
              <Button
                variant={filters.native_languages_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.native_languages_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('native_languages_isnull')}
              >
                Native Languages: Empty
              </Button>
              <Button
                variant={filters.other_languages_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.other_languages_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('other_languages_isnull')}
              >
                Other Languages: Empty
              </Button>
              <Button
                variant={filters.gender_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.gender_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('gender_isnull')}
              >
                Gender: Empty
              </Button>
              <Button
                variant={filters.birthdate_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.birthdate_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('birthdate_isnull')}
              >
                Birth Date: Empty
              </Button>
              <Button
                variant={filters.deathdate_isnull ? "contained" : "outlined"}
                size="small"
                color={filters.deathdate_isnull ? "primary" : "secondary"}
                onClick={() => handleEmptyFilterToggle('deathdate_isnull')}
              >
                Death Date: Empty
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Results Count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {loading ? 'Loading...' : `${totalCount} collaborator${totalCount !== 1 ? 's' : ''} found`}
      </Typography>

      {/* Mobile Card View */}
      {isMobile ? (
        <Stack spacing={2}>
          {collaborators.map((collaborator) => (
            <Card 
              key={collaborator.id} 
              sx={{ 
                cursor: selectable ? 'default' : 'pointer',
                '&:hover': selectable ? {} : { backgroundColor: 'action.hover' }
              }}
              onClick={() => !selectable && handleRowClick(collaborator)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" component="h3">
                      {collaborator.display_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ID: {collaborator.collaborator_id}
                    </Typography>
                    {collaborator.tribal_affiliations && (
                      <Typography variant="body2" color="text.secondary">
                        Tribal Affiliations: {collaborator.tribal_affiliations}
                      </Typography>
                    )}
                    {collaborator.native_language_names.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Native Languages:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {collaborator.native_language_names.map((lang, index) => (
                            <Chip key={index} label={lang} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                  {selectable && (
                    <Checkbox
                      checked={selectedCollaborators.some(c => c.id === collaborator.id)}
                      onChange={(e) => handleCollaboratorSelect(collaborator, e.target.checked)}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        /* Desktop Table View */
        <TableContainer component={Paper}>
          <Table ref={tableRef} tabIndex={-1}>
            <TableHead>
              <TableRow>
                {selectable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={isIndeterminate}
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                )}
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Tribal Affiliations</TableCell>
                <TableCell>Native Languages</TableCell>
                <TableCell>Other Languages</TableCell>
                <TableCell>Items</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {collaborators.map((collaborator) => (
                <TableRow
                  key={collaborator.id}
                  hover={!selectable}
                  sx={{ 
                    cursor: selectable ? 'default' : 'pointer',
                    '&:hover': selectable ? {} : { backgroundColor: 'action.hover' }
                  }}
                  onClick={() => handleRowClick(collaborator)}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedCollaborators.some(c => c.id === collaborator.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCollaboratorSelect(collaborator, e.target.checked);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {collaborator.display_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {collaborator.collaborator_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {collaborator.tribal_affiliations || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {collaborator.native_language_names.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {collaborator.native_language_names.slice(0, 3).map((lang, index) => (
                          <Chip key={index} label={lang} size="small" variant="outlined" />
                        ))}
                        {collaborator.native_language_names.length > 3 && (
                          <Chip 
                            label={`+${collaborator.native_language_names.length - 3} more`} 
                            size="small" 
                            variant="outlined" 
                            color="secondary"
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {collaborator.other_language_names.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {collaborator.other_language_names.slice(0, 2).map((lang, index) => (
                          <Chip key={index} label={lang} size="small" variant="outlined" />
                        ))}
                        {collaborator.other_language_names.length > 2 && (
                          <Chip 
                            label={`+${collaborator.other_language_names.length - 2} more`} 
                            size="small" 
                            variant="outlined" 
                            color="secondary"
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {collaborator.associated_items.length}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[10, 25, 50, 100]}
        showFirstButton
        showLastButton
      />
    </Box>
  );
};

export default CollaboratorsList;
