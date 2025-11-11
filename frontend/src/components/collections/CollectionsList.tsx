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
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { collectionsAPI, Collection, PaginatedResponse, APIError } from '../../services/api';

interface CollectionsListProps {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedCollections: Collection[]) => void;
}

interface FilterState {
  collection_abbr_contains: string;
  name_contains: string;
  extent_contains: string;
  abstract_contains: string;
  description_contains: string;
  date_range_contains: string;
  access_levels_contains: string;
  genres_contains: string;
  languages_contains: string;
  citation_authors_contains: string;
  keyword_contains: string;
}

const CollectionsList: React.FC<CollectionsListProps> = ({
  showActions = true,
  selectable = false,
  onSelectionChange,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Refs for focus management
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  
  // State management
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<Collection[]>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    collection_abbr_contains: '',
    name_contains: '',
    extent_contains: '',
    abstract_contains: '',
    description_contains: '',
    date_range_contains: '',
    access_levels_contains: '',
    genres_contains: '',
    languages_contains: '',
    citation_authors_contains: '',
    keyword_contains: '',
  });

  // Load collections from API
  const loadCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const queryParams: Record<string, string | number> = {
        page: page + 1,
        page_size: rowsPerPage,
      };

      // Add filters to query params (only non-empty values)
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) {
          queryParams[key] = value.trim();
        }
      });

      const response: PaginatedResponse<Collection> = await collectionsAPI.list(queryParams);
      
      setCollections(response.results);
      setTotalCount(response.count);
    } catch (err) {
      console.error('Error loading collections:', err);
      if (err instanceof APIError) {
        setError(`Failed to load collections: ${err.message}`);
      } else {
        setError('Failed to load collections. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  // Load collections on component mount and when dependencies change
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Handle filter changes
  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
    // Reset to first page when filters change
    setPage(0);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      collection_abbr_contains: '',
      name_contains: '',
      extent_contains: '',
      abstract_contains: '',
      description_contains: '',
      date_range_contains: '',
      access_levels_contains: '',
      genres_contains: '',
      languages_contains: '',
      citation_authors_contains: '',
      keyword_contains: '',
    });
    setPage(0);
  };

  // Handle search (trigger reload)
  const handleSearch = () => {
    setPage(0);
    loadCollections();
  };

  // Handle page change
  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle collection selection
  const handleSelectCollection = (collection: Collection, selected: boolean) => {
    let newSelection: Collection[];
    
    if (selected) {
      newSelection = [...selectedCollections, collection];
    } else {
      newSelection = selectedCollections.filter(item => item.id !== collection.id);
    }
    
    setSelectedCollections(newSelection);
    onSelectionChange?.(newSelection);
  };

  // Handle select all
  const handleSelectAll = (selected: boolean) => {
    const newSelection = selected ? [...collections] : [];
    setSelectedCollections(newSelection);
    onSelectionChange?.(newSelection);
  };

  // Navigation handlers
  const handleViewCollection = (collection: Collection) => {
    navigate(`/collections/${collection.id}`);
  };

  const handleCreateCollection = () => {
    navigate('/collections/create');
  };

  // Check if collection is selected
  const isCollectionSelected = (collection: Collection) => {
    return selectedCollections.some(item => item.id === collection.id);
  };

  // Calculate selection state
  const selectedCount = selectedCollections.length;
  const isAllSelected = collections.length > 0 && selectedCount === collections.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < collections.length;

  // Mobile card component for responsive design
  const MobileCollectionCard: React.FC<{ collection: Collection }> = ({ collection }) => (
    <Card 
      sx={{ 
        mb: 2, 
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' }
      }}
      onClick={() => handleViewCollection(collection)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          {selectable && (
            <Checkbox
              checked={isCollectionSelected(collection)}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectCollection(collection, e.target.checked);
              }}
              sx={{ mr: 1, mt: -1 }}
            />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'medium' }}>
              {collection.collection_abbr}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              {collection.name}
            </Typography>
            
            {collection.abstract && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {collection.abstract.length > 150 
                  ? `${collection.abstract.substring(0, 150)}...` 
                  : collection.abstract}
              </Typography>
            )}
            
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {collection.extent && (
                <Chip label={`Extent: ${collection.extent}`} size="small" variant="outlined" />
              )}
              {collection.date_range && (
                <Chip label={collection.date_range} size="small" variant="outlined" />
              )}
              {(collection.item_count ?? 0) > 0 && (
                <Chip label={`${collection.item_count ?? 0} items`} size="small" color="primary" variant="outlined" />
              )}
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Collections
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateCollection}
        >
          Create Collection
        </Button>
      </Box>

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            label="Search collections"
            value={filters.keyword_contains}
            onChange={(e) => handleFilterChange('keyword_contains', e.target.value)}
            variant="outlined"
            size="small"
            sx={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            ref={searchButtonRef}
          >
            Search
          </Button>
          <Button
            variant="outlined"
            startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
        </Box>

        {/* Advanced Filters */}
        <Collapse in={showFilters}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' } }}>
            <TextField
              label="Collection Abbreviation"
              value={filters.collection_abbr_contains}
              onChange={(e) => handleFilterChange('collection_abbr_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Name"
              value={filters.name_contains}
              onChange={(e) => handleFilterChange('name_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Extent"
              value={filters.extent_contains}
              onChange={(e) => handleFilterChange('extent_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Abstract"
              value={filters.abstract_contains}
              onChange={(e) => handleFilterChange('abstract_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Description"
              value={filters.description_contains}
              onChange={(e) => handleFilterChange('description_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Date Range"
              value={filters.date_range_contains}
              onChange={(e) => handleFilterChange('date_range_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Access Levels"
              value={filters.access_levels_contains}
              onChange={(e) => handleFilterChange('access_levels_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Genres"
              value={filters.genres_contains}
              onChange={(e) => handleFilterChange('genres_contains', e.target.value)}
              size="small"
            />
            <TextField
              label="Languages"
              value={filters.languages_contains}
              onChange={(e) => handleFilterChange('languages_contains', e.target.value)}
              size="small"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          </Box>
        </Collapse>
      </Paper>

      {/* Selection Summary */}
      {selectable && selectedCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {selectedCount} collection{selectedCount !== 1 ? 's' : ''} selected
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Collections List */}
      {!loading && (
        <>
          {/* Desktop Table View */}
          {!isMobile && (
            <TableContainer component={Paper}>
              <Table ref={tableRef} stickyHeader>
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
                    <TableCell>Abbreviation</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Extent</TableCell>
                    <TableCell>Date Range</TableCell>
                    <TableCell>Items</TableCell>
                    <TableCell>Abstract</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {collections.length === 0 && (
                    <TableRow>
                      <TableCell 
                        colSpan={selectable ? 7 : 6} 
                        align="center" 
                        sx={{ py: 4, color: 'text.secondary' }}
                      >
                        No collections found
                      </TableCell>
                    </TableRow>
                  )}
                  {collections.map((collection) => (
                    <TableRow
                      key={collection.id}
                      hover
                      onClick={() => handleViewCollection(collection)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {selectable && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isCollectionSelected(collection)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectCollection(collection, e.target.checked);
                            }}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/collections/${collection.id}`}
                          onClick={(e) => e.stopPropagation()}
                          variant="body2"
                          sx={{ 
                            fontWeight: 'medium',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {collection.collection_abbr}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {collection.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {collection.extent || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {collection.date_range || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={(collection.item_count ?? 0).toString()} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {collection.abstract || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Mobile Card View */}
          {isMobile && (
            <Box>
              {collections.length === 0 && (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No collections found
                  </Typography>
                </Paper>
              )}
              {collections.map((collection) => (
                <MobileCollectionCard key={collection.id} collection={collection} />
              ))}
            </Box>
          )}

          {/* Pagination */}
          {totalCount > 0 && (
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{ mt: 2 }}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default CollectionsList;
