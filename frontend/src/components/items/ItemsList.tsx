import React, { useState, useEffect, useCallback } from 'react';
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
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { itemsAPI, Item, PaginatedResponse, APIError } from '../../services/api';

interface ItemsListProps {
  // Optional props for customization
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedItems: Item[]) => void;
}

interface FilterState {
  catalog_number_contains: string;
  item_access_level_contains: string;
  call_number_contains: string;
  accession_date_min: string;
  accession_date_max: string;
  indigenous_title_contains: string;
  english_title_contains: string;
  titles_contains: string;
  resource_type_contains: string;
  language_contains: string;
  creation_date_min: string;
  creation_date_max: string;
  description_scope_and_content_contains: string;
  genre_contains: string;
  collaborator_contains: string;
  depositor_name_contains: string;
  keyword_contains: string;
}

const ItemsList: React.FC<ItemsListProps> = ({
  showActions = true,
  selectable = false,
  onSelectionChange,
}) => {
  const navigate = useNavigate();
  
  // State management
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    catalog_number_contains: '',
    item_access_level_contains: '',
    call_number_contains: '',
    accession_date_min: '',
    accession_date_max: '',
    indigenous_title_contains: '',
    english_title_contains: '',
    titles_contains: '',
    resource_type_contains: '',
    language_contains: '',
    creation_date_min: '',
    creation_date_max: '',
    description_scope_and_content_contains: '',
    genre_contains: '',
    collaborator_contains: '',
    depositor_name_contains: '',
    keyword_contains: '',
  });

  // Load items from API
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params: Record<string, string | number> = {
        page: page + 1, // Django pagination is 1-based
        page_size: rowsPerPage,
      };

      // Add non-empty filters to params
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim()) {
          params[key] = value.trim();
        }
      });

      const response: PaginatedResponse<Item> = await itemsAPI.list(params);
      
      setItems(response.results);
      setTotalCount(response.count);
    } catch (err) {
      console.error('Error loading items:', err);
      if (err instanceof APIError) {
        setError(`Failed to load items: ${err.message}`);
      } else {
        setError('Failed to load items. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  // Load items on component mount and when dependencies change
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handle filter changes
  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Apply filters (reset to first page)
  const handleApplyFilters = () => {
    setPage(0);
    loadItems();
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      catalog_number_contains: '',
      item_access_level_contains: '',
      call_number_contains: '',
      accession_date_min: '',
      accession_date_max: '',
      indigenous_title_contains: '',
      english_title_contains: '',
      titles_contains: '',
      resource_type_contains: '',
      language_contains: '',
      creation_date_min: '',
      creation_date_max: '',
      description_scope_and_content_contains: '',
      genre_contains: '',
      collaborator_contains: '',
      depositor_name_contains: '',
      keyword_contains: '',
    });
    setPage(0);
  };

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle item selection
  const handleItemSelection = (item: Item, selected: boolean) => {
    let newSelection: Item[];
    if (selected) {
      newSelection = [...selectedItems, item];
    } else {
      newSelection = selectedItems.filter(i => i.id !== item.id);
    }
    setSelectedItems(newSelection);
    onSelectionChange?.(newSelection);
  };

  // Navigation handlers
  const handleViewItem = (item: Item) => {
    navigate(`/items/${item.id}`);
  };

  const handleEditItem = (item: Item) => {
    navigate(`/items/${item.id}/edit`);
  };

  const handleDeleteItem = (item: Item) => {
    // TODO: Implement delete confirmation dialog
    console.log('Delete item:', item);
  };

  const handleAddItem = () => {
    navigate('/items/add');
  };

  // Get active filter count
  const activeFilterCount = Object.values(filters).filter(value => value && value.trim()).length;

  if (loading && items.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" component="h1">
          Items ({totalCount.toLocaleString()})
        </Typography>
        {showActions && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
        )}
      </Box>

      {/* Filter Controls */}
      <Paper sx={{ mb: 2, p: 2 }}>
        <Box display="flex" alignItems="center" gap={2} mb={showFilters ? 2 : 0}>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            color={activeFilterCount > 0 ? 'primary' : 'inherit'}
          >
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
          
          {activeFilterCount > 0 && (
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              size="small"
            >
              Clear All
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleApplyFilters}
            disabled={loading}
          >
            Search
          </Button>
        </Box>

        <Collapse in={showFilters}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {/* Basic Info Filters */}
            <TextField
              fullWidth
              label="Catalog Number"
              value={filters.catalog_number_contains}
              onChange={(e) => handleFilterChange('catalog_number_contains', e.target.value)}
              size="small"
            />
            
            <TextField
              fullWidth
              label="Call Number"
              value={filters.call_number_contains}
              onChange={(e) => handleFilterChange('call_number_contains', e.target.value)}
              size="small"
            />

            <TextField
              fullWidth
              label="Access Level"
              value={filters.item_access_level_contains}
              onChange={(e) => handleFilterChange('item_access_level_contains', e.target.value)}
              size="small"
            />

            {/* Title Filters */}
            <TextField
              fullWidth
              label="Indigenous Title"
              value={filters.indigenous_title_contains}
              onChange={(e) => handleFilterChange('indigenous_title_contains', e.target.value)}
              size="small"
            />

            <TextField
              fullWidth
              label="English Title"
              value={filters.english_title_contains}
              onChange={(e) => handleFilterChange('english_title_contains', e.target.value)}
              size="small"
            />

            <TextField
              fullWidth
              label="Any Title"
              value={filters.titles_contains}
              onChange={(e) => handleFilterChange('titles_contains', e.target.value)}
              size="small"
            />

            {/* Content Filters */}
            <TextField
              fullWidth
              label="Resource Type"
              value={filters.resource_type_contains}
              onChange={(e) => handleFilterChange('resource_type_contains', e.target.value)}
              size="small"
            />

            <TextField
              fullWidth
              label="Genre"
              value={filters.genre_contains}
              onChange={(e) => handleFilterChange('genre_contains', e.target.value)}
              size="small"
            />

            <TextField
              fullWidth
              label="Language"
              value={filters.language_contains}
              onChange={(e) => handleFilterChange('language_contains', e.target.value)}
              size="small"
            />

            {/* People Filters */}
            <TextField
              fullWidth
              label="Collaborator"
              value={filters.collaborator_contains}
              onChange={(e) => handleFilterChange('collaborator_contains', e.target.value)}
              size="small"
            />

            <TextField
              fullWidth
              label="Depositor Name"
              value={filters.depositor_name_contains}
              onChange={(e) => handleFilterChange('depositor_name_contains', e.target.value)}
              size="small"
            />

            <TextField
              fullWidth
              label="Keywords"
              value={filters.keyword_contains}
              onChange={(e) => handleFilterChange('keyword_contains', e.target.value)}
              size="small"
            />

            {/* Date Filters */}
            <TextField
              fullWidth
              label="Accession Date (From)"
              type="date"
              value={filters.accession_date_min}
              onChange={(e) => handleFilterChange('accession_date_min', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />

            <TextField
              fullWidth
              label="Accession Date (To)"
              type="date"
              value={filters.accession_date_max}
              onChange={(e) => handleFilterChange('accession_date_max', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />

            <TextField
              fullWidth
              label="Creation Date (From)"
              type="date"
              value={filters.creation_date_min}
              onChange={(e) => handleFilterChange('creation_date_min', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />

            <TextField
              fullWidth
              label="Creation Date (To)"
              type="date"
              value={filters.creation_date_max}
              onChange={(e) => handleFilterChange('creation_date_max', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Box>
          
          {/* Description Filter - Full Width */}
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Description/Scope and Content"
              value={filters.description_scope_and_content_contains}
              onChange={(e) => handleFilterChange('description_scope_and_content_contains', e.target.value)}
              size="small"
              multiline
              rows={2}
            />
          </Box>
        </Collapse>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Items Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {selectable && <TableCell padding="checkbox">Select</TableCell>}
              <TableCell>Catalog #</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Resource Type</TableCell>
              <TableCell>Languages</TableCell>
              <TableCell>Collaborators</TableCell>
              <TableCell>Access Level</TableCell>
              <TableCell>Collection</TableCell>
              {showActions && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 8 : 7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 8 : 7} align="center">
                  No items found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} hover>
                  {selectable && (
                    <TableCell padding="checkbox">
                      <input
                        type="checkbox"
                        checked={selectedItems.some(i => i.id === item.id)}
                        onChange={(e) => handleItemSelection(item, e.target.checked)}
                      />
                    </TableCell>
                  )}
                  
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.catalog_number}
                    </Typography>
                    {item.call_number && (
                      <Typography variant="caption" color="text.secondary">
                        Call: {item.call_number}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {item.titles && item.titles.length > 0 ? (
                      <Box>
                        {item.titles.map((title, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            sx={{ 
                              fontWeight: title.default ? 'medium' : 'normal',
                              fontStyle: title.default ? 'normal' : 'italic'
                            }}
                          >
                            {title.title}
                            {title.language_name && (
                              <Typography component="span" variant="caption" color="text.secondary">
                                {' '}({title.language_name})
                              </Typography>
                            )}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No title
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Chip 
                      label={item.resource_type || 'Unknown'} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell>
                    {item.language_names && item.language_names.length > 0 ? (
                      <Box>
                        {item.language_names.map((lang, index) => (
                          <Chip 
                            key={index}
                            label={lang} 
                            size="small" 
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        None
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {item.collaborator_names && item.collaborator_names.length > 0 ? (
                      <Box>
                        {item.collaborator_names.slice(0, 2).map((collab, index) => (
                          <Chip 
                            key={index}
                            label={collab} 
                            size="small" 
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                        {item.collaborator_names.length > 2 && (
                          <Typography variant="caption" color="text.secondary">
                            +{item.collaborator_names.length - 2} more
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        None
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Chip 
                      label={item.access_level || 'Unknown'} 
                      size="small"
                      color={item.access_level === 'Public' ? 'success' : 'default'}
                    />
                  </TableCell>

                  <TableCell>
                    {item.collection_name ? (
                      <Typography variant="body2">
                        {item.collection_name}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        None
                      </Typography>
                    )}
                  </TableCell>

                  {showActions && (
                    <TableCell align="center">
                      <IconButton 
                        size="small" 
                        onClick={() => handleViewItem(item)}
                        title="View Details"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditItem(item)}
                        title="Edit Item"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteItem(item)}
                        title="Delete Item"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};

export default ItemsList;
