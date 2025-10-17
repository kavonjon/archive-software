import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  firstname_contains: string;
  lastname_contains: string;
  name_contains: string;
  collaborator_id_contains: string;
  tribal_affiliations_contains: string;
  native_languages_contains: string;
  other_languages_contains: string;
  anonymous: string;
  gender_contains: string;
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
  const searchButtonRef = useRef<HTMLButtonElement>(null);
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

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    firstname_contains: '',
    lastname_contains: '',
    name_contains: '',
    collaborator_id_contains: '',
    tribal_affiliations_contains: '',
    native_languages_contains: '',
    other_languages_contains: '',
    anonymous: '',
    gender_contains: '',
  });

  // Load collaborators data
  const loadCollaborators = useCallback(async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentPage = resetPage ? 0 : page;
      
      // Build query parameters
      const params: Record<string, string | number> = {
        page: currentPage + 1, // API uses 1-based pagination
        page_size: rowsPerPage,
        ordering: 'lastname,firstname,name,collaborator_id', // Explicit ordering by last name
      };
      
      // Add non-empty filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) {
          params[key] = value.trim();
        }
      });
      
      const response = await collaboratorsAPI.list(params);
      
      setCollaborators(response.results);
      setTotalCount(response.count);
      
      if (resetPage) {
        setPage(0);
      }
      
    } catch (err) {
      const apiError = err as APIError;
      setError(apiError.message || 'Failed to load collaborators');
      console.error('Error loading collaborators:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

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

  // Handle filter changes
  const handleFilterChange = (field: keyof FilterState) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  // Handle search
  const handleSearch = () => {
    loadCollaborators(true);
    
    // Focus management for screen readers
    if (tableRef.current) {
      tableRef.current.focus();
    }
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setFilters({
      firstname_contains: '',
      lastname_contains: '',
      name_contains: '',
      collaborator_id_contains: '',
      tribal_affiliations_contains: '',
      native_languages_contains: '',
      other_languages_contains: '',
      anonymous: '',
      gender_contains: '',
    });
    
    // Reload with cleared filters
    setTimeout(() => {
      loadCollaborators(true);
    }, 0);
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
  const hasActiveFilters = Object.values(filters).some(value => value.trim() !== '');

  // Selection state
  const isAllSelected = collaborators.length > 0 && selectedCollaborators.length === collaborators.length;
  const isIndeterminate = selectedCollaborators.length > 0 && selectedCollaborators.length < collaborators.length;

  if (loading && collaborators.length === 0) {
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Button
            ref={searchButtonRef}
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={loading}
          >
            Search
          </Button>
          <Button
            variant="outlined"
            startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              color="secondary"
            >
              Clear Filters
            </Button>
          )}
        </Box>

        {/* Filter Fields */}
        <Collapse in={showFilters}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>
            <TextField
              label="First Name Contains"
              value={filters.firstname_contains}
              onChange={handleFilterChange('firstname_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Last Name Contains"
              value={filters.lastname_contains}
              onChange={handleFilterChange('lastname_contains')}
              size="small"
              fullWidth
            />
            <TextField
              label="Name Contains"
              value={filters.name_contains}
              onChange={handleFilterChange('name_contains')}
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
