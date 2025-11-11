import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  OutlinedInput,
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { debounce } from 'lodash';
import { itemsAPI, Item, PaginatedResponse, APIError, ACCESS_LEVEL_CHOICES, RESOURCE_TYPE_CHOICES } from '../../services/api';
import { ariaLabels, focusUtils, tableUtils, formUtils } from '../../utils/accessibility';
import { touchTargets } from '../../utils/responsive';

interface ItemsListProps {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedItems: Item[]) => void;
}

interface FilterState {
  keyword_contains: string;
  catalog_number_contains: string;
  access_level: string[];  // Multi-select array
  call_number_contains: string;
  accession_date_min: string;
  accession_date_max: string;
  titles_contains: string;
  resource_type: string[];  // Multi-select array
  language_contains: string;
  creation_date_min: string;
  creation_date_max: string;
  description_scope_and_content_contains: string;
  genre_contains: string;
  collaborator_contains: string;
  depositor_name_contains: string;
  
  // Empty field filters (isnull)
  collection_isnull?: boolean;
  access_level_restrictions_isnull?: boolean;
  accession_date_isnull?: boolean;
  accession_number_isnull?: boolean;
  call_number_isnull?: boolean;
  collaborator_isnull?: boolean;
  creation_date_isnull?: boolean;
  depositor_name_isnull?: boolean;
  description_scope_and_content_isnull?: boolean;
  genre_isnull?: boolean;
  indigenous_title_isnull?: boolean;
  english_title_isnull?: boolean;
  item_access_level_isnull?: boolean;
  language_isnull?: boolean;
  resource_type_isnull?: boolean;
  original_format_medium_isnull?: boolean;
  publisher_isnull?: boolean;
  recording_context_isnull?: boolean;
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
  const tableRef = useRef<HTMLTableElement>(null);
  
  // State management
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Selection state (always enabled, using Set for efficient lookups)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    keyword_contains: '',
    catalog_number_contains: '',
    access_level: [],
    call_number_contains: '',
    accession_date_min: '',
    accession_date_max: '',
    titles_contains: '',
    resource_type: [],
    language_contains: '',
    creation_date_min: '',
    creation_date_max: '',
    description_scope_and_content_contains: '',
    genre_contains: '',
    collaborator_contains: '',
    depositor_name_contains: '',
  });

  // Active filters state - these are the filters actually applied to the API
  const [activeFilters, setActiveFilters] = useState<FilterState>(filters);

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
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // For multi-select fields, send comma-separated values if not empty
          if (value.length > 0) {
            params[key] = value.join(',');
          }
        } else if (typeof value === 'boolean') {
          // For boolean filters (isnull), add if true
          if (value === true) {
            params[key] = 'true';
          }
        } else if (value && value.trim()) {
          // For text fields, add if not empty
          params[key] = value.trim();
        }
      });

      const response: PaginatedResponse<Item> = await itemsAPI.list(params);
      
      setItems(response.results);
      setTotalCount(response.count);
      setInitialLoadComplete(true);

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

  // Load items on component mount and when dependencies change
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handle filter changes
  const handleFilterChange = (field: keyof FilterState, value: string | string[]) => {
    const newFilters = {
      ...filters,
      [field]: value,
    };
    setFilters(newFilters);
    
    // Debounced API call - waits 500ms after user stops typing
    debouncedApplyFilters(newFilters);
  };

  // Handle empty filter toggle
  const handleEmptyFilterToggle = (field: keyof FilterState) => {
    const currentValue = filters[field] as boolean | undefined;
    const newValue = currentValue === true ? undefined : true;
    
    const newFilters = {
      ...filters,
      [field]: newValue,
    };
    setFilters(newFilters);
    
    // Immediately apply (no need for debounce on button clicks)
    debouncedApplyFilters.cancel();
    setActiveFilters(newFilters);
    setPage(0);
  };

  // Clear all filters
  const handleClearFilters = () => {
    const clearedFilters = {
      keyword_contains: '',
      catalog_number_contains: '',
      access_level: [],
      call_number_contains: '',
      accession_date_min: '',
      accession_date_max: '',
      titles_contains: '',
      resource_type: [],
      language_contains: '',
      creation_date_min: '',
      creation_date_max: '',
      description_scope_and_content_contains: '',
      genre_contains: '',
      collaborator_contains: '',
      depositor_name_contains: '',
      // Reset all empty field filters
      collection_isnull: undefined,
      access_level_restrictions_isnull: undefined,
      accession_date_isnull: undefined,
      accession_number_isnull: undefined,
      call_number_isnull: undefined,
      collaborator_isnull: undefined,
      creation_date_isnull: undefined,
      depositor_name_isnull: undefined,
      description_scope_and_content_isnull: undefined,
      genre_isnull: undefined,
      indigenous_title_isnull: undefined,
      english_title_isnull: undefined,
      item_access_level_isnull: undefined,
      language_isnull: undefined,
      resource_type_isnull: undefined,
      original_format_medium_isnull: undefined,
      publisher_isnull: undefined,
      recording_context_isnull: undefined,
    };
    setFilters(clearedFilters);
    
    // Immediately apply cleared filters
    debouncedApplyFilters.cancel();
    setActiveFilters(clearedFilters);
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
  // Handle individual item selection
  const handleItemSelection = useCallback((item: Item, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(item.id);
      } else {
        newSet.delete(item.id);
      }
      return newSet;
    });
    
    focusUtils.announce(
      checked 
        ? `Selected item ${item.catalog_number}` 
        : `Deselected item ${item.catalog_number}`,
      'polite'
    );
  }, []);

  // Handle "Deselect All" button
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  };

  // Handle select all on current page
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        items.forEach(item => newSet.add(item.id));
      } else {
        items.forEach(item => newSet.delete(item.id));
      }
      return newSet;
    });
    
    // If parent component needs full objects
    if (onSelectionChange) {
      onSelectionChange(checked ? items : []);
    }
    
    focusUtils.announce(
      checked ? `Selected all ${items.length} items on this page` : 'Deselected all items', 
      'polite'
    );
  };

  // Navigation handlers
  const handleViewItem = useCallback((item: Item) => {
    navigate(`/items/${item.id}`);
  }, [navigate]);

  const handleAddItem = () => {
    navigate('/items/create');
  };

  // Get active filter count
  const activeFilterCount = Object.values(filters).filter(value => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'boolean') {
      return value === true;
    }
    return value && value.trim();
  }).length;
  // Selection state calculations
  const selectedCount = items.filter(item => selectedIds.has(item.id)).length;
  const isAllSelected = items.length > 0 && selectedCount === items.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < items.length;

  // Mobile card view for items - memoized to prevent recreating on every render
  const renderMobileCard = useCallback((item: Item) => (
    <Card 
      key={item.id}
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
          <Box onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.has(item.id)}
              onChange={(e) => handleItemSelection(item, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select item ${item.catalog_number}`}
              sx={{ p: 1 }}
            />
          </Box>
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

        {item.description && (
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ 
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  ), [selectedIds, handleViewItem, handleItemSelection]);

  // Show full-page loading only on initial load, not on subsequent filter/pagination changes
  if (!initialLoadComplete) {
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography 
            id="items-heading"
            variant="h4" 
            component="h1"
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
          >
            Items ({totalCount.toLocaleString()})
          </Typography>
          {/* Selection indicator */}
          {selectedIds.size > 0 && (
            <Chip
              label={`${selectedIds.size} selected`}
              color="primary"
              size="medium"
              onDelete={handleDeselectAll}
              deleteIcon={<CheckBoxIcon />}
            />
          )}
        </Box>
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
            aria-expanded={showFilters}
            aria-controls="filter-panel"
            sx={{ minHeight: touchTargets.minSize }}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          
          {activeFilterCount > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                color="secondary"
                size="small"
                sx={{ minHeight: touchTargets.minSize }}
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
            {/* Keyword Search - First */}
            <TextField
              {...formUtils.generateFieldProps('keyword_contains', 'Keywords')}
              label="Keywords"
              value={filters.keyword_contains}
              onChange={(e) => handleFilterChange('keyword_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Catalog Number */}
            <TextField
              {...formUtils.generateFieldProps('catalog_number_contains', 'Catalog Number')}
              label="Catalog Number"
              value={filters.catalog_number_contains}
              onChange={(e) => handleFilterChange('catalog_number_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Access Level - Multi-select */}
            <FormControl size="small" fullWidth>
              <InputLabel id="access-level-label">Access Level</InputLabel>
              <Select
                labelId="access-level-label"
                multiple
                value={filters.access_level}
                onChange={(e) => handleFilterChange('access_level', e.target.value as string[])}
                input={<OutlinedInput label="Access Level" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = ACCESS_LEVEL_CHOICES.find(c => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {ACCESS_LEVEL_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={filters.access_level.indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Call Number */}
            <TextField
              {...formUtils.generateFieldProps('call_number_contains', 'Call Number')}
              label="Call Number"
              value={filters.call_number_contains}
              onChange={(e) => handleFilterChange('call_number_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Titles (renamed from "Any Title") */}
            <TextField
              {...formUtils.generateFieldProps('titles_contains', 'Titles')}
              label="Titles"
              value={filters.titles_contains}
              onChange={(e) => handleFilterChange('titles_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Resource Type - Multi-select */}
            <FormControl size="small" fullWidth>
              <InputLabel id="resource-type-label">Resource Type</InputLabel>
              <Select
                labelId="resource-type-label"
                multiple
                value={filters.resource_type}
                onChange={(e) => handleFilterChange('resource_type', e.target.value as string[])}
                input={<OutlinedInput label="Resource Type" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = RESOURCE_TYPE_CHOICES.find(c => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {RESOURCE_TYPE_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={filters.resource_type.indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Genre */}
            <TextField
              {...formUtils.generateFieldProps('genre_contains', 'Genre')}
              label="Genre"
              value={filters.genre_contains}
              onChange={(e) => handleFilterChange('genre_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Language */}
            <TextField
              {...formUtils.generateFieldProps('language_contains', 'Language')}
              label="Language"
              value={filters.language_contains}
              onChange={(e) => handleFilterChange('language_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Collaborator */}
            <TextField
              {...formUtils.generateFieldProps('collaborator_contains', 'Collaborator')}
              label="Collaborator"
              value={filters.collaborator_contains}
              onChange={(e) => handleFilterChange('collaborator_contains', e.target.value)}
              size="small"
              fullWidth
            />

            {/* Depositor Name */}
            <TextField
              {...formUtils.generateFieldProps('depositor_name_contains', 'Depositor Name')}
              label="Depositor Name"
              value={filters.depositor_name_contains}
              onChange={(e) => handleFilterChange('depositor_name_contains', e.target.value)}
              size="small"
              fullWidth
            />

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

          {/* Empty Field Filters */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" gutterBottom>
              Find Records With Empty Values:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant={filters.collection_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.collection_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('collection_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Collection: Empty
              </Button>
              <Button
                variant={filters.access_level_restrictions_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.access_level_restrictions_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('access_level_restrictions_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Access Level Restrictions: Empty
              </Button>
              <Button
                variant={filters.accession_date_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.accession_date_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('accession_date_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Accession Date: Empty
              </Button>
              <Button
                variant={filters.accession_number_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.accession_number_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('accession_number_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Accession Number: Empty
              </Button>
              <Button
                variant={filters.call_number_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.call_number_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('call_number_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Call Number: Empty
              </Button>
              <Button
                variant={filters.collaborator_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.collaborator_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('collaborator_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Collaborator: Empty
              </Button>
              <Button
                variant={filters.creation_date_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.creation_date_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('creation_date_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Creation Date: Empty
              </Button>
              <Button
                variant={filters.depositor_name_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.depositor_name_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('depositor_name_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Depositor Name: Empty
              </Button>
              <Button
                variant={filters.description_scope_and_content_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.description_scope_and_content_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('description_scope_and_content_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Description: Empty
              </Button>
              <Button
                variant={filters.genre_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.genre_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('genre_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Genre: Empty
              </Button>
              <Button
                variant={filters.indigenous_title_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.indigenous_title_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('indigenous_title_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Indigenous Title: Empty
              </Button>
              <Button
                variant={filters.english_title_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.english_title_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('english_title_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                English Title: Empty
              </Button>
              <Button
                variant={filters.item_access_level_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.item_access_level_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('item_access_level_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Access Level: Empty
              </Button>
              <Button
                variant={filters.language_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.language_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('language_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Language: Empty
              </Button>
              <Button
                variant={filters.resource_type_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.resource_type_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('resource_type_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Resource Type: Empty
              </Button>
              <Button
                variant={filters.original_format_medium_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.original_format_medium_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('original_format_medium_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Original Format/Medium: Empty
              </Button>
              <Button
                variant={filters.publisher_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.publisher_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('publisher_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Publisher: Empty
              </Button>
              <Button
                variant={filters.recording_context_isnull ? 'contained' : 'outlined'}
                size="small"
                color={filters.recording_context_isnull ? 'primary' : 'secondary'}
                onClick={() => handleEmptyFilterToggle('recording_context_isnull')}
                sx={{ minHeight: touchTargets.minSize }}
              >
                Recording Context: Empty
              </Button>
            </Box>
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
            items.map((item) => renderMobileCard(item))
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
                <TableCell 
                  padding="checkbox"
                  {...tableUtils.generateHeaderProps('select')}
                >
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    icon={<CheckBoxOutlineBlankIcon />}
                    checkedIcon={<CheckBoxIcon />}
                    aria-label={
                      isAllSelected 
                        ? ariaLabels.selectAllRows
                        : 'Select all items on this page'
                    }
                  />
                </TableCell>
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
              </TableRow>
            </TableHead>
            
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={7} 
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
                    colSpan={7} 
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
                    <TableCell 
                      padding="checkbox"
                      {...tableUtils.generateCellProps('select', index)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={(e) => handleItemSelection(item, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        icon={<CheckBoxOutlineBlankIcon />}
                        checkedIcon={<CheckBoxIcon />}
                        aria-label={ariaLabels.selectRow}
                      />
                    </TableCell>
                    
                    <TableCell {...tableUtils.generateCellProps('catalog', index)}>
                      <Link
                        component={RouterLink}
                        to={`/items/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        variant="body2"
                        sx={{ 
                          fontWeight: 'medium',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        {item.catalog_number}
                      </Link>
                      {item.call_number && (
                        <Typography variant="caption" color="text.secondary" display="block">
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