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
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
} from '@mui/material';
import {
  Clear as ClearIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { collectionsAPI, Collection, PaginatedResponse, APIError, GENRE_CHOICES, ACCESS_LEVEL_CHOICES } from '../../services/api';
import { usePersistedListState } from '../../hooks/usePersistedListState';
import { touchTargets } from '../../utils/responsive';
import { ariaLabels, focusUtils, formUtils, tableUtils } from '../../utils/accessibility';
import { downloadCollectionsCsv } from '../../utils/collectionExport';
import CollectionExportButton, { ExportMode, ExportStatus } from './CollectionExportButton';

interface CollectionsListProps {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedCollections: Collection[]) => void;
}

interface FilterState {
  collection_abbr_contains: string;
  name_contains: string;
  access_levels: string[];
  genres: string[];
  languages_contains: string;
  collaborator_contains: string;
  keyword_contains: string;
}

const DEFAULT_FILTERS: FilterState = {
  collection_abbr_contains: '',
  name_contains: '',
  access_levels: [],
  genres: [],
  languages_contains: '',
  collaborator_contains: '',
  keyword_contains: '',
};

function countCollectionFilters(filterState: FilterState, excludeKeyword = false): number {
  return Object.entries(filterState).filter(([key, value]) => {
    if (excludeKeyword && key === 'keyword_contains') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  }).length;
}

function buildCollectionQueryParams(
  activeFilters: FilterState,
  page: number,
  rowsPerPage: number
): Record<string, string | number> {
  const queryParams: Record<string, string | number> = {
    page: page + 1,
    page_size: rowsPerPage,
  };

  Object.entries(activeFilters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        const joined = value.join(',');
        // django-filter skips empty CharFilter values; comma-only encodes "Not specified"
        queryParams[key] = key === 'access_levels' && joined === '' ? ',' : joined;
      }
    } else if (typeof value === 'string' && value.trim()) {
      queryParams[key] = value.trim();
    }
  });

  return queryParams;
}

const CollectionsList: React.FC<CollectionsListProps> = ({
  showActions = true,
  selectable = false,
  onSelectionChange,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const tableRef = useRef<HTMLTableElement>(null);

  const {
    filters,
    setFilters,
    selectedIds,
    setSelectedIds,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    toggleSelection,
    setAllSelections,
    clearFilters: clearPersistedFilters,
  } = usePersistedListState<FilterState, Collection>({
    storageKey: 'collection-list-state-v5',
    defaultFilters: DEFAULT_FILTERS,
    defaultPagination: { page: 0, rowsPerPage: 25 },
  });

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>(filters);
  const [exportMode, setExportMode] = useState<ExportMode>(() => {
    return (localStorage.getItem('collection-export-mode') as ExportMode) || 'filtered';
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');

  const loadCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response: PaginatedResponse<Collection> = await collectionsAPI.list(
        buildCollectionQueryParams(activeFilters, page, rowsPerPage)
      );

      setCollections(response.results);
      setTotalCount(response.count);
      setInitialLoadComplete(true);
    } catch (err) {
      console.error('Error loading collections:', err);
      if (err instanceof APIError) {
        setError(`Failed to load collections: ${err.message}`);
      } else {
        setError('Failed to load collections. Please try again.');
      }
      setInitialLoadComplete(true);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, activeFilters]);

  const debouncedApplyFilters = useMemo(
    () => debounce((newFilters: FilterState) => {
      setActiveFilters(newFilters);
      setPage(0);
    }, 500),
    [setPage]
  );

  useEffect(() => {
    return () => {
      debouncedApplyFilters.cancel();
    };
  }, [debouncedApplyFilters]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleFilterChange = (field: keyof FilterState, value: string | string[]) => {
    const newFilters = {
      ...filters,
      [field]: value,
    };
    setFilters(newFilters);
    debouncedApplyFilters(newFilters);
  };

  const handleClearFilters = () => {
    clearPersistedFilters();
    debouncedApplyFilters.cancel();
    setActiveFilters(DEFAULT_FILTERS);
    setPage(0);
    focusUtils.announce('All filters cleared', 'polite');
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
    focusUtils.announce(`Navigated to page ${newPage + 1}`, 'polite');
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    focusUtils.announce(`Changed to ${newRowsPerPage} collections per page`, 'polite');
  };

  const handleViewCollection = useCallback((collection: Collection) => {
    navigate(`/collections/${collection.id}`);
  }, [navigate]);

  const handleCollectionSelection = useCallback((collection: Collection, checked: boolean) => {
    toggleSelection(collection.id, checked);

    focusUtils.announce(
      checked
        ? `Selected collection ${collection.collection_abbr}`
        : `Deselected collection ${collection.collection_abbr}`,
      'polite'
    );
  }, [toggleSelection]);

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    onSelectionChange?.([]);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setAllSelections(collections, checked);
    onSelectionChange?.(checked ? collections : []);

    focusUtils.announce(
      checked ? `Selected all ${collections.length} collections on this page` : 'Deselected all collections',
      'polite'
    );
  };

  const handleCreateCollection = () => {
    navigate('/collections/create');
  };

  const fetchAllFilteredCollections = useCallback(async (): Promise<Collection[]> => {
    const queryParams = buildCollectionQueryParams(activeFilters, 0, Math.max(totalCount, 1));
    queryParams.page = 1;
    queryParams.page_size = Math.max(totalCount, 1);

    const response = await collectionsAPI.list(queryParams);
    return response.results;
  }, [activeFilters, totalCount]);

  const handleExportExecute = useCallback(async (mode: ExportMode) => {
    try {
      setExportStatus('preparing');

      let exportCollections: Collection[];

      if (mode === 'selected') {
        const ids = Array.from(selectedIds);
        exportCollections = await Promise.all(ids.map((id) => collectionsAPI.get(id)));
      } else {
        exportCollections = await fetchAllFilteredCollections();
      }

      if (exportCollections.length === 0) {
        setError('No collections to export.');
        setExportStatus('idle');
        return;
      }

      downloadCollectionsCsv(exportCollections);
      setExportStatus('ready');
      focusUtils.announce(`Exported ${exportCollections.length} collections`, 'polite');

      window.setTimeout(() => {
        setExportStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('[CollectionsList] Export error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
      setExportStatus('idle');
    }
  }, [selectedIds, fetchAllFilteredCollections]);

  const hasActiveFilters = countCollectionFilters(activeFilters) > 0;
  const advancedFilterCount = countCollectionFilters(activeFilters, true);

  const selectedCount = collections.filter((collection) => selectedIds.has(collection.id)).length;
  const isAllSelected = collections.length > 0 && selectedCount === collections.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < collections.length;

  const renderMobileCard = useCallback((collection: Collection) => (
    <Card
      key={collection.id}
      sx={{
        mb: 2,
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
      role="article"
      aria-labelledby={`collection-${collection.id}-title`}
      onClick={() => handleViewCollection(collection)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          {selectable && (
            <Box onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedIds.has(collection.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  handleCollectionSelection(collection, e.target.checked);
                }}
                aria-label={`Select collection ${collection.collection_abbr}`}
                sx={{ mr: 1, mt: -1 }}
              />
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography
              id={`collection-${collection.id}-title`}
              variant="h6"
              component="h3"
              sx={{ fontWeight: 'medium' }}
            >
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
                <Chip
                  label={`${collection.item_count ?? 0} items`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  ), [selectable, selectedIds, handleViewCollection, handleCollectionSelection]);

  if (!initialLoadComplete) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
        role="status"
        aria-live="polite"
        aria-label="Loading collections"
      >
        <CircularProgress aria-label="Loading collections list" />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading collections...
        </Typography>
      </Box>
    );
  }

  return (
    <Box role="region" aria-labelledby="collections-heading">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            id="collections-heading"
            variant="h4"
            component="h1"
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
          >
            Collections
          </Typography>
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
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <CollectionExportButton
              mode={exportMode}
              exportStatus={exportStatus}
              onModeChange={setExportMode}
              onExecute={handleExportExecute}
              selectedCount={selectedIds.size}
              filteredCount={totalCount}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateCollection}
              sx={{ minHeight: touchTargets.minSize }}
              aria-label="Create new collection"
            >
              {isMobile ? 'Add' : 'Create Collection'}
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }} role="search" aria-labelledby="filter-heading">
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
          Filter Collections
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: showFilters ? 2 : 0,
            flexWrap: 'wrap',
          }}
        >
          <TextField
            {...formUtils.generateFieldProps('keyword_contains', 'Keywords')}
            label="Keywords"
            value={filters.keyword_contains}
            onChange={(e) => handleFilterChange('keyword_contains', e.target.value)}
            variant="outlined"
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
            fullWidth
          />
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
          {hasActiveFilters && (
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
              {advancedFilterCount > 0 && (
                <Chip
                  icon={<FilterListIcon />}
                  label={`${advancedFilterCount} active filter${advancedFilterCount !== 1 ? 's' : ''}`}
                  color="primary"
                  variant="outlined"
                />
              )}
            </>
          )}
        </Box>

        <Collapse in={showFilters}>
          <Box
            id="filter-panel"
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            }}
            role="group"
            aria-labelledby="filter-heading"
          >
            <TextField
              {...formUtils.generateFieldProps('collection_abbr_contains', 'Collection Abbreviation')}
              label="Collection Abbreviation"
              value={filters.collection_abbr_contains}
              onChange={(e) => handleFilterChange('collection_abbr_contains', e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              {...formUtils.generateFieldProps('name_contains', 'Collection Name')}
              label="Collection Name"
              value={filters.name_contains}
              onChange={(e) => handleFilterChange('name_contains', e.target.value)}
              size="small"
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="access-levels-label">Access Level</InputLabel>
              <Select
                labelId="access-levels-label"
                multiple
                value={filters.access_levels ?? []}
                onChange={(e) => handleFilterChange('access_levels', e.target.value as string[])}
                input={<OutlinedInput label="Access Level" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = ACCESS_LEVEL_CHOICES.find((c) => c.value === value);
                      return (
                        <Chip
                          key={value || 'unspecified'}
                          label={choice?.label || value || 'Not specified'}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {ACCESS_LEVEL_CHOICES.map((choice) => (
                  <MenuItem key={choice.value || 'unspecified'} value={choice.value}>
                    <Checkbox checked={(filters.access_levels ?? []).indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              {...formUtils.generateFieldProps('languages_contains', 'Language')}
              label="Language"
              value={filters.languages_contains}
              onChange={(e) => handleFilterChange('languages_contains', e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              {...formUtils.generateFieldProps('collaborator_contains', 'Collaborator')}
              label="Collaborator"
              value={filters.collaborator_contains}
              onChange={(e) => handleFilterChange('collaborator_contains', e.target.value)}
              size="small"
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="genres-label">Genre</InputLabel>
              <Select
                labelId="genres-label"
                multiple
                value={filters.genres ?? []}
                onChange={(e) => handleFilterChange('genres', e.target.value as string[])}
                input={<OutlinedInput label="Genre" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const choice = GENRE_CHOICES.find((c) => c.value === value);
                      return <Chip key={value} label={choice?.label || value} size="small" />;
                    })}
                  </Box>
                )}
                MenuProps={{
                  PaperProps: {
                    style: { maxHeight: 360 },
                  },
                }}
              >
                {GENRE_CHOICES.map((choice) => (
                  <MenuItem key={choice.value} value={choice.value}>
                    <Checkbox checked={(filters.genres ?? []).indexOf(choice.value) > -1} />
                    {choice.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {loading ? 'Loading...' : `${totalCount.toLocaleString()} collection${totalCount !== 1 ? 's' : ''} found`}
      </Typography>

      {selectable && selectedCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {selectedCount} collection{selectedCount !== 1 ? 's' : ''} selected on this page
        </Alert>
      )}

      {!isMobile && (
        <TableContainer component={Paper}>
          <Table
            ref={tableRef}
            tabIndex={-1}
            role="table"
            aria-label="Collections table"
            aria-rowcount={totalCount}
            aria-describedby="table-description"
          >
            <caption
              id="table-description"
              {...tableUtils.generateCaptionProps(totalCount, collections.length)}
            />
            <TableHead>
              <TableRow role="row">
                {selectable && (
                  <TableCell padding="checkbox" {...tableUtils.generateHeaderProps('select')}>
                    <Checkbox
                      indeterminate={isIndeterminate}
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      icon={<CheckBoxOutlineBlankIcon />}
                      checkedIcon={<CheckBoxIcon />}
                      aria-label={
                        isAllSelected
                          ? ariaLabels.selectAllRows
                          : 'Select all collections on this page'
                      }
                    />
                  </TableCell>
                )}
                <TableCell {...tableUtils.generateHeaderProps('abbreviation')}>Abbreviation</TableCell>
                <TableCell {...tableUtils.generateHeaderProps('name')}>Name</TableCell>
                <TableCell {...tableUtils.generateHeaderProps('date-range')}>Date Range</TableCell>
                <TableCell {...tableUtils.generateHeaderProps('items')}>Items</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {collections.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={selectable ? 5 : 4}
                    align="center"
                    sx={{ py: 4, color: 'text.secondary' }}
                  >
                    No collections found
                  </TableCell>
                </TableRow>
              )}
              {collections.map((collection, rowIndex) => (
                <TableRow
                  key={collection.id}
                  hover
                  onClick={() => handleViewCollection(collection)}
                  sx={{ cursor: 'pointer' }}
                  role="row"
                >
                  {selectable && (
                    <TableCell padding="checkbox" {...tableUtils.generateCellProps('select', rowIndex)}>
                      <Checkbox
                        checked={selectedIds.has(collection.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCollectionSelection(collection, e.target.checked);
                        }}
                        aria-label={`Select collection ${collection.collection_abbr}`}
                      />
                    </TableCell>
                  )}
                  <TableCell {...tableUtils.generateCellProps('abbreviation', rowIndex)}>
                    <Link
                      component={RouterLink}
                      to={`/collections/${collection.id}`}
                      onClick={(e) => e.stopPropagation()}
                      variant="body2"
                      sx={{
                        fontWeight: 'medium',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {collection.collection_abbr}
                    </Link>
                  </TableCell>
                  <TableCell {...tableUtils.generateCellProps('name', rowIndex)}>
                    <Typography variant="body2">{collection.name}</Typography>
                  </TableCell>
                  <TableCell {...tableUtils.generateCellProps('date-range', rowIndex)}>
                    <Typography variant="body2" color="text.secondary">
                      {collection.date_range || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell {...tableUtils.generateCellProps('items', rowIndex)}>
                    <Chip
                      label={(collection.item_count ?? 0).toString()}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {isMobile && (
        <Box role="list" aria-label="Collections list">
          {collections.length === 0 ? (
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              py={4}
              role="status"
            >
              No collections found
            </Typography>
          ) : (
            collections.map((collection) => renderMobileCard(collection))
          )}
        </Box>
      )}

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
    </Box>
  );
};

export default CollectionsList;
