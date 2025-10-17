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
import { itemsAPI, Item, PaginatedResponse, APIError } from '../../services/api';
import { ariaLabels, focusUtils, tableUtils, formUtils } from '../../utils/accessibility';
import { touchTargets } from '../../utils/responsive';

interface ItemsListProps {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedItems: Item[]) => void;
}

interface FilterState {
  catalog_number_contains: string;
  access_level_contains: string;
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Refs for focus management
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  
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
    access_level_contains: '',
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

      // Announce results to screen readers
      focusUtils.announce(
        `Loaded ${response.results.length} items of ${response.count} total`,
        'polite'
      );
    } catch (err) {
      console.error('Error loading items:', err);
      const errorMessage = err instanceof APIError 
        ? `Failed to load items: ${err.message}` 
        : 'Failed to load items. Please try again.';
      
      setError(errorMessage);
      focusUtils.announce(errorMessage, 'assertive');
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
    
    // Focus back to table for screen readers
    if (tableRef.current) {
      tableRef.current.focus();
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      catalog_number_contains: '',
      access_level_contains: '',
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
    focusUtils.announce('All filters cleared', 'polite');
  };

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    focusUtils.announce(`Navigated to page ${newPage + 1}`, 'polite');
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    focusUtils.announce(`Changed to ${newRowsPerPage} items per page`, 'polite');
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
    
    focusUtils.announce(
      selected 
        ? `Selected item ${item.catalog_number}` 
        : `Deselected item ${item.catalog_number}`,
      'polite'
    );
  };

  // Handle select all
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedItems([...items]);
      onSelectionChange?.(items);
      focusUtils.announce(`Selected all ${items.length} items on this page`, 'polite');
    } else {
      setSelectedItems([]);
      onSelectionChange?.([]);
      focusUtils.announce('Deselected all items', 'polite');
    }
  };

  // Navigation handlers
  const handleViewItem = (item: Item) => {
    navigate(`/items/${item.id}`);
  };

  const handleAddItem = () => {
    navigate('/items/create');
  };

  // Get active filter count
  const activeFilterCount = Object.values(filters).filter(value => value && value.trim()).length;
  const isAllSelected = selectable && items.length > 0 && selectedItems.length === items.length;
  const isIndeterminate = selectable && selectedItems.length > 0 && selectedItems.length < items.length;

  // Mobile card view for items
  const MobileItemCard: React.FC<{ item: Item }> = ({ item }) => (
    <Card 
      sx={{ 
        mb: 2,
        cursor: 'pointer',
        '&:hover': {
          boxShadow: 2,
        },
      }}
      role="article"
      aria-labelledby={`item-${item.id}-title`}
      onClick={() => handleViewItem(item)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography 
            id={`item-${item.id}-title`}
            variant="h6" 
            component="h3"
            sx={{ fontWeight: 'medium' }}
          >
            {item.catalog_number}
          </Typography>
          {selectable && (
            <Checkbox
              checked={selectedItems.some(i => i.id === item.id)}
              onChange={(e) => handleItemSelection(item, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select item ${item.catalog_number}`}
              sx={{ p: 1 }}
            />
          )}
        </Box>

        {item.call_number && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Call Number: {item.call_number}
          </Typography>
        )}

        {item.titles && item.titles.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Title(s):</Typography>
            {item.titles.map((title, index) => (
              <Typography
                key={index}
                variant="body2"
                sx={{
                  fontWeight: title.default ? 'medium' : 'normal',
                  fontStyle: title.default ? 'normal' : 'italic',
                  ml: 1,
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
        )}

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip 
            label={item.resource_type_display || 'Unknown'} 
            size="small" 
            variant="outlined"
          />
          <Chip 
            label={item.item_access_level_display || 'Unknown'} 
            size="small"
            color={item.item_access_level === '1' ? 'success' : 'default'}
          />
        </Stack>

        {item.language_names && item.language_names.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Languages:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.language_names.map((lang, index) => (
                <Chip key={index} label={lang} size="small" />
              ))}
            </Box>
          </Box>
        )}

        {item.collaborator_names && item.collaborator_names.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Collaborators:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.collaborator_names.slice(0, 3).map((collab, index) => (
                <Chip key={index} label={collab} size="small" />
              ))}
              {item.collaborator_names.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  +{item.collaborator_names.length - 3} more
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {item.collection_name && (
          <Typography variant="body2" color="text.secondary">
            Collection: {item.collection_name}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading && items.length === 0) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="400px"
        role="status"
        aria-live="polite"
        aria-label="Loading items"
      >
        <CircularProgress aria-label="Loading items list" />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading items...
        </Typography>
      </Box>
    );
  }

  return (
    <Box role="region" aria-labelledby="items-heading">
      {/* Header */}
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={2}
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={2}
      >
        <Typography 
          id="items-heading"
          variant="h4" 
          component="h1"
          sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
        >
          Items ({totalCount.toLocaleString()})
        </Typography>
        {showActions && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
            sx={{ minHeight: touchTargets.minSize }}
            aria-label={ariaLabels.add}
          >
            Add Item
          </Button>
        )}
      </Box>

      {/* Filter Controls */}
      <Paper sx={{ mb: 2, p: 2 }} role="search" aria-labelledby="filter-heading">
        <Typography 
          id="filter-heading" 
          variant="h6" 
          component="h2"
          sx={{ 
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          Filter Items
        </Typography>
        
        <Box 
          display="flex" 
          alignItems="center" 
          gap={2} 
          mb={showFilters ? 2 : 0}
          flexWrap="wrap"
        >
          <Button
            variant="outlined"
            startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
            color={activeFilterCount > 0 ? 'primary' : 'inherit'}
            aria-expanded={showFilters}
            aria-controls="filter-panel"
            sx={{ minHeight: touchTargets.minSize }}
          >
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
          
          {activeFilterCount > 0 && (
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              size="small"
              sx={{ minHeight: touchTargets.minSize }}
            >
              Clear All
            </Button>
          )}

          <Button
            ref={searchButtonRef}
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleApplyFilters}
            disabled={loading}
            sx={{ minHeight: touchTargets.minSize }}
          >
            Search
          </Button>
        </Box>

        <Collapse in={showFilters}>
          <Box 
            id="filter-panel"
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { 
                xs: '1fr', 
                sm: 'repeat(2, 1fr)', 
                md: 'repeat(3, 1fr)' 
              }, 
              gap: 2 
            }}
            role="group"
            aria-labelledby="filter-heading"
          >
            {/* Filter fields - using consistent pattern */}
            {Object.entries({
              catalog_number_contains: 'Catalog Number',
              call_number_contains: 'Call Number',
              access_level_contains: 'Access Level',
              indigenous_title_contains: 'Indigenous Title',
              english_title_contains: 'English Title',
              titles_contains: 'Any Title',
              resource_type_contains: 'Resource Type',
              genre_contains: 'Genre',
              language_contains: 'Language',
              collaborator_contains: 'Collaborator',
              depositor_name_contains: 'Depositor Name',
              keyword_contains: 'Keywords',
            }).map(([field, label]) => (
              <TextField
                key={field}
                {...formUtils.generateFieldProps(field, label)}
                label={label}
                value={filters[field as keyof FilterState]}
                onChange={(e) => handleFilterChange(field as keyof FilterState, e.target.value)}
                size="small"
                fullWidth
              />
            ))}

            {/* Date filters */}
            {Object.entries({
              accession_date_min: 'Accession Date (From)',
              accession_date_max: 'Accession Date (To)',
              creation_date_min: 'Creation Date (From)',
              creation_date_max: 'Creation Date (To)',
            }).map(([field, label]) => (
              <TextField
                key={field}
                {...formUtils.generateFieldProps(field, label)}
                label={label}
                type="date"
                value={filters[field as keyof FilterState]}
                onChange={(e) => handleFilterChange(field as keyof FilterState, e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth
              />
            ))}
          </Box>
          
          {/* Description Filter - Full Width */}
          <Box sx={{ mt: 2 }}>
            <TextField
              {...formUtils.generateFieldProps('description_scope_and_content_contains', 'Description/Scope and Content')}
              label="Description/Scope and Content"
              value={filters.description_scope_and_content_contains}
              onChange={(e) => handleFilterChange('description_scope_and_content_contains', e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </Collapse>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </Alert>
      )}

      {/* Items Display - Mobile Cards or Desktop Table */}
      {isMobile ? (
        // Mobile card view
        <Box role="list" aria-label="Items list">
          {items.length === 0 ? (
            <Typography 
              variant="body1" 
              color="text.secondary" 
              textAlign="center" 
              py={4}
              role="status"
            >
              No items found
            </Typography>
          ) : (
            items.map((item) => (
              <MobileItemCard key={item.id} item={item} />
            ))
          )}
        </Box>
      ) : (
        // Desktop table view
        <TableContainer component={Paper}>
          <Table 
            ref={tableRef}
            tabIndex={-1}
            role="table"
            aria-label="Items table"
            aria-rowcount={totalCount}
            aria-describedby="table-description"
          >
            <caption 
              id="table-description"
              {...tableUtils.generateCaptionProps(totalCount, items.length)}
            />
            
            <TableHead>
              <TableRow role="row">
                {selectable && (
                  <TableCell 
                    padding="checkbox"
                    {...tableUtils.generateHeaderProps('select')}
                  >
                    <Checkbox
                      indeterminate={isIndeterminate}
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      aria-label={
                        isAllSelected 
                          ? ariaLabels.selectAllRows
                          : 'Select all items on this page'
                      }
                    />
                  </TableCell>
                )}
                <TableCell {...tableUtils.generateHeaderProps('catalog')}>
                  Catalog #
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('title')}>
                  Title
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('type')}>
                  Resource Type
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('languages')}>
                  Languages
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('collaborators')}>
                  Collaborators
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('access')}>
                  Access Level
                </TableCell>
                <TableCell {...tableUtils.generateHeaderProps('collection')}>
                  Collection
                </TableCell>
              </TableRow>
            </TableHead>
            
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={selectable ? 8 : 7} 
                    align="center"
                    role="status"
                    aria-live="polite"
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <CircularProgress size={24} aria-label="Loading more items" />
                      <Typography>Loading items...</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={selectable ? 8 : 7} 
                    align="center"
                    role="status"
                  >
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow 
                    key={item.id} 
                    hover
                    onClick={() => handleViewItem(item)}
                    role="row"
                    aria-rowindex={page * rowsPerPage + index + 1}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                    aria-label={`View details for item ${item.catalog_number}`}
                  >
                    {selectable && (
                      <TableCell 
                        padding="checkbox"
                        {...tableUtils.generateCellProps('select', index)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedItems.some(i => i.id === item.id)}
                          onChange={(e) => handleItemSelection(item, e.target.checked)}
                          aria-label={ariaLabels.selectRow}
                        />
                      </TableCell>
                    )}
                    
                    <TableCell {...tableUtils.generateCellProps('catalog', index)}>
                      <Typography variant="body2" fontWeight="medium">
                        {item.catalog_number}
                      </Typography>
                      {item.call_number && (
                        <Typography variant="caption" color="text.secondary">
                          Call: {item.call_number}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('title', index)}>
                      {item.titles && item.titles.length > 0 ? (
                        <Box>
                          {item.titles.map((title, titleIndex) => (
                            <Typography
                              key={titleIndex}
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

                    <TableCell {...tableUtils.generateCellProps('type', index)}>
                      <Chip 
                        label={item.resource_type_display || 'Unknown'} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('languages', index)}>
                      {item.language_names && item.language_names.length > 0 ? (
                        <Box>
                          {item.language_names.map((lang, langIndex) => (
                            <Chip 
                              key={langIndex}
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

                    <TableCell {...tableUtils.generateCellProps('collaborators', index)}>
                      {item.collaborator_names && item.collaborator_names.length > 0 ? (
                        <Box>
                          {item.collaborator_names.slice(0, 2).map((collab, collabIndex) => (
                            <Chip 
                              key={collabIndex}
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

                    <TableCell {...tableUtils.generateCellProps('access', index)}>
                      <Chip 
                        label={item.item_access_level_display || 'Unknown'} 
                        size="small"
                        color={item.item_access_level === '1' ? 'success' : 'default'}
                      />
                    </TableCell>

                    <TableCell {...tableUtils.generateCellProps('collection', index)}>
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
            aria-label={ariaLabels.pagination}
            labelRowsPerPage="Items per page:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
            }
          />
        </TableContainer>
      )}
    </Box>
  );
};

export default ItemsList;