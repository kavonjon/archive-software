import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ButtonGroup,
  Container,
  useTheme,
  useMediaQuery,
  Pagination,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { languoidsAPI, type Languoid, LANGUOID_LEVEL_CHOICES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguoidCache } from '../../contexts/LanguoidCacheContext';
import { hasEditAccess } from '../../utils/permissions';

// Level filter presets
const LEVEL_FILTER_PRESETS = [
  { key: 'all', label: 'All Languoids', levels: [], useGlottolog: false },
  { key: 'languages', label: 'Languages Only', levels: ['language'], useGlottolog: false },
  { key: 'dialects', label: 'Dialects Only', levels: ['dialect'], useGlottolog: false },
  { key: 'languages_dialects', label: 'Languages & Dialects', levels: ['language', 'dialect'], useGlottolog: false },
  { key: 'families', label: 'Families Only', levels: ['family'], useGlottolog: true }, // Use level_glottolog
];

// Level badge colors
const LEVEL_COLORS = {
  family: 'primary',
  language: 'success', 
  dialect: 'warning'
} as const;

interface HierarchicalLanguoid extends Languoid {
  indentLevel: number;
}

const LanguoidsList: React.FC = () => {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const { getLanguoids, refreshCache, isLoading: cacheLoading, error: cacheError } = useLanguoidCache();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Ref for scrolling to top of list
  const listTopRef = useRef<HTMLDivElement>(null);

  // Data state
  const [allLanguoids, setAllLanguoids] = useState<Languoid[]>([]); // Store ALL languoids (unfiltered)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  // Display pagination state (frontend only)
  const [displayPage, setDisplayPage] = useState(1);
  const minPageSize = 50; // Minimum items per page

  // Load ALL languoids using cache
  const loadLanguoids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use cache context to get languoids (will check validity automatically)
      const languoids = await getLanguoids();
      setAllLanguoids(languoids);
    } catch (err) {
      console.error('Error loading languoids:', err);
      setError(cacheError || 'Failed to load languoids. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getLanguoids, cacheError]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const languoids = await refreshCache();
      setAllLanguoids(languoids);
    } catch (err) {
      console.error('Error refreshing languoids:', err);
      setError('Failed to refresh languoids. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  // Apply filters on frontend (instant, no API call)
  const filteredLanguoids = useMemo(() => {
    let filtered = allLanguoids;

    // Apply level preset filter
    const preset = LEVEL_FILTER_PRESETS.find(p => p.key === selectedLevelFilter);
    if (preset && preset.levels.length > 0) {
      // Use level_glottolog or level_nal based on preset configuration
      if (preset.useGlottolog) {
        filtered = filtered.filter(languoid => preset.levels.includes(languoid.level_glottolog));
      } else {
        filtered = filtered.filter(languoid => preset.levels.includes(languoid.level_nal));
      }
    }

    // Apply advanced level filter (if set)
    if (levelFilter) {
      filtered = filtered.filter(languoid => languoid.level_nal === levelFilter);
    }

    // Apply search term (searches name, ISO, glottocode, region, tribes)
    if (searchTerm.trim()) {
      const search = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(languoid => 
        languoid.name.toLowerCase().includes(search) ||
        (languoid.iso && languoid.iso.toLowerCase().includes(search)) ||
        (languoid.glottocode && languoid.glottocode.toLowerCase().includes(search)) ||
        (languoid.region && languoid.region.toLowerCase().includes(search)) ||
        (languoid.tribes && languoid.tribes.toLowerCase().includes(search))
      );
    }

    // Apply family filter
    if (familyFilter.trim()) {
      const familySearch = familyFilter.trim().toLowerCase();
      filtered = filtered.filter(languoid => 
        languoid.family_name && languoid.family_name.toLowerCase().includes(familySearch)
      );
    }

    // Apply region filter
    if (regionFilter.trim()) {
      const regionSearch = regionFilter.trim().toLowerCase();
      filtered = filtered.filter(languoid => 
        languoid.region && languoid.region.toLowerCase().includes(regionSearch)
      );
    }

    return filtered;
  }, [allLanguoids, selectedLevelFilter, levelFilter, searchTerm, familyFilter, regionFilter]);

  // Build hierarchical display with indentation
  const hierarchicalLanguoids = useMemo((): HierarchicalLanguoid[] => {
    const result: HierarchicalLanguoid[] = [];
    const processed = new Set<number>();

    // Helper function to add languoid and its children recursively
    const addLanguoidWithChildren = (languoid: Languoid, indentLevel: number = 0) => {
      if (processed.has(languoid.id)) return;
      
      processed.add(languoid.id);
      result.push({ ...languoid, indentLevel });

      // Find and add direct children only (using parent_languoid relationship)
      // This ensures correct hierarchical sorting: parent → children → grandchildren
      const children = filteredLanguoids.filter(l => 
        !processed.has(l.id) && l.parent_languoid === languoid.id
      ).sort((a, b) => a.name.localeCompare(b.name));

      children.forEach(child => {
        addLanguoidWithChildren(child, indentLevel + 1);
      });
    };

    // Check if we're in "Languages & Dialects" mode
    const preset = LEVEL_FILTER_PRESETS.find(p => p.key === selectedLevelFilter);
    const isLanguagesAndDialects = preset?.key === 'languages_dialects';

    if (isLanguagesAndDialects) {
      // Special handling: Show languages as root nodes with their dialects nested
      const languages = filteredLanguoids.filter(l => l.level_nal === 'language').sort((a, b) => a.name.localeCompare(b.name));
      languages.forEach(language => addLanguoidWithChildren(language, 0));

      // Add any orphaned dialects (dialects without a language parent in the filtered set)
      const orphanDialects = filteredLanguoids.filter(l => 
        !processed.has(l.id) && l.level_nal === 'dialect'
      ).sort((a, b) => a.name.localeCompare(b.name));
      orphanDialects.forEach(dialect => addLanguoidWithChildren(dialect, 0));
    } else {
      // Normal hierarchical display: start with top-level items
      const topLevel = filteredLanguoids.filter(l => l.level_nal === 'family').sort((a, b) => a.name.localeCompare(b.name));
      topLevel.forEach(item => addLanguoidWithChildren(item, 0));

      // Add any orphaned languoids (those without proper parent relationships)
      const orphans = filteredLanguoids.filter(l => !processed.has(l.id)).sort((a, b) => a.name.localeCompare(b.name));
      orphans.forEach(orphan => addLanguoidWithChildren(orphan, 0));
    }

    return result;
  }, [filteredLanguoids, selectedLevelFilter]);

  // Smart pagination: calculate page breaks at family boundaries
  const { paginatedLanguoids, pageBreaks, totalPages } = useMemo(() => {
    if (hierarchicalLanguoids.length === 0) {
      return { paginatedLanguoids: [], pageBreaks: [], totalPages: 0 };
    }

    // Calculate page breaks that respect top-level family boundaries
    const breaks: number[] = [0]; // Start of first page
    let currentIndex = 0;

    while (currentIndex < hierarchicalLanguoids.length) {
      // Find the next break point (minimum minPageSize items ahead)
      let breakPoint = currentIndex + minPageSize;

      // If we're past the end, we're done
      if (breakPoint >= hierarchicalLanguoids.length) {
        breaks.push(hierarchicalLanguoids.length);
        break;
      }

      // Find the next top-level item (indentLevel === 0) after the minimum page size
      // This ensures we don't split a family tree across pages
      let foundBreak = false;
      for (let i = breakPoint; i < hierarchicalLanguoids.length; i++) {
        if (hierarchicalLanguoids[i].indentLevel === 0) {
          // Found a top-level item - this is a natural break point
          breakPoint = i;
          foundBreak = true;
          break;
        }
      }

      // If we didn't find a top-level item, just use the rest of the list
      if (!foundBreak) {
        breakPoint = hierarchicalLanguoids.length;
      }

      breaks.push(breakPoint);
      currentIndex = breakPoint;
    }

    // Get the items for the current page
    const startIndex = breaks[displayPage - 1] || 0;
    const endIndex = breaks[displayPage] || hierarchicalLanguoids.length;
    const pageItems = hierarchicalLanguoids.slice(startIndex, endIndex);

    return {
      paginatedLanguoids: pageItems,
      pageBreaks: breaks,
      totalPages: breaks.length - 1
    };
  }, [hierarchicalLanguoids, displayPage, minPageSize]);

  // Load data on component mount and when filters change
  useEffect(() => {
    loadLanguoids();
  }, [loadLanguoids]);

  const handleRowClick = (languoid: Languoid) => {
    // Use glottocode for URL if available, otherwise fall back to ID
    const identifier = languoid.glottocode || languoid.id;
    navigate(`/languoids/${identifier}`);
  };

  const handleCreateClick = () => {
    navigate('/languoids/create');
  };

  const handleLevelFilterChange = (filterKey: string) => {
    setSelectedLevelFilter(filterKey);
    setDisplayPage(1); // Reset to first page
  };

  const clearFilters = () => {
    setSearchTerm('');
    setLevelFilter('');
    setFamilyFilter('');
    setRegionFilter('');
    setSelectedLevelFilter('all');
    setDisplayPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setDisplayPage(newPage);
  };

  // Scroll to top when page changes (after render completes)
  useEffect(() => {
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [displayPage]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Languages
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh list data">
            <IconButton
              color="primary"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              sx={{ 
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              {isRefreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          {hasEditAccess(authState.user) && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
            >
              Add Languoid
            </Button>
          )}
        </Box>
      </Box>

      {/* Prominent Level Filter Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Filter by Type
          </Typography>
          <ButtonGroup 
            variant="outlined" 
            sx={{ 
              flexWrap: 'wrap',
              '& .MuiButton-root': {
                mb: 1,
                mr: 1
              }
            }}
          >
            {LEVEL_FILTER_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={selectedLevelFilter === preset.key ? 'contained' : 'outlined'}
                onClick={() => handleLevelFilterChange(preset.key)}
                size={isMobile ? 'small' : 'medium'}
              >
                {preset.label}
              </Button>
            ))}
          </ButtonGroup>
        </CardContent>
      </Card>

      {/* Collapsible Advanced Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Advanced Filters
            </Typography>
            <IconButton onClick={() => setFiltersOpen(!filtersOpen)}>
              {filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={filtersOpen}>
            <Box sx={{ mt: 2 }}>
              <Stack spacing={2} direction={isMobile ? 'column' : 'row'}>
                <TextField
                  label="Search"
                  variant="outlined"
                  size="small"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                  sx={{ flex: 1 }}
                />
                
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Level</InputLabel>
                  <Select
                    value={levelFilter}
                    label="Level"
                    onChange={(e) => setLevelFilter(e.target.value)}
                  >
                    <MenuItem value="">All Levels</MenuItem>
                    {LANGUOID_LEVEL_CHOICES.map((choice) => (
                      <MenuItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Family"
                  variant="outlined"
                  size="small"
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  sx={{ flex: 1 }}
                />

                <TextField
                  label="Region"
                  variant="outlined"
                  size="small"
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  sx={{ flex: 1 }}
                />

                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  size="small"
                >
                  Clear
                </Button>
              </Stack>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results Count with scroll target */}
      <Box ref={listTopRef}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {pageBreaks[displayPage - 1] + 1}-{pageBreaks[displayPage]} of {hierarchicalLanguoids.length} languoids
          {paginatedLanguoids.length > minPageSize && ` (${paginatedLanguoids.length} on this page)`}
          {filteredLanguoids.length !== allLanguoids.length && ` • ${allLanguoids.length} total`}
        </Typography>
      </Box>

      {/* Hierarchical Table/List */}
      {isMobile ? (
        // Mobile: Card layout
        <Stack spacing={2}>
          {paginatedLanguoids.map((languoid) => (
            <Card 
              key={languoid.id}
              sx={{ 
                cursor: 'pointer',
                ml: languoid.indentLevel * 2, // Indent for hierarchy
                '&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={() => handleRowClick(languoid)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Chip
                    label={languoid.level_display}
                    color={LEVEL_COLORS[languoid.level_nal as keyof typeof LEVEL_COLORS]}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="h6" sx={{ flex: 1 }}>
                    {languoid.name}
                  </Typography>
                </Box>
                
                <Stack spacing={1}>
                  {languoid.iso && (
                    <Typography variant="body2" color="text.secondary">
                      ISO: {languoid.iso}
                    </Typography>
                  )}
                  {languoid.glottocode && (
                    <Typography variant="body2" color="text.secondary">
                      Glottocode: {languoid.glottocode}
                    </Typography>
                  )}
                  {languoid.family_name && (
                    <Typography variant="body2" color="text.secondary">
                      Family: {languoid.family_name}
                    </Typography>
                  )}
                  {languoid.region && (
                    <Typography variant="body2" color="text.secondary">
                      Region: {languoid.region}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        // Desktop: Table layout
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>ISO</TableCell>
                <TableCell>Glottocode</TableCell>
                <TableCell>Family</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Children</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLanguoids.map((languoid) => (
                <TableRow
                  key={languoid.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(languoid)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {/* Hierarchical indentation */}
                      <Box sx={{ width: languoid.indentLevel * 24 }} />
                      <Typography variant="body1">
                        {languoid.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={languoid.level_display}
                      color={LEVEL_COLORS[languoid.level_nal as keyof typeof LEVEL_COLORS]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{languoid.iso || '—'}</TableCell>
                  <TableCell>{languoid.glottocode || '—'}</TableCell>
                  <TableCell>{languoid.family_name || '—'}</TableCell>
                  <TableCell>{languoid.region || '—'}</TableCell>
                  <TableCell>
                    {languoid.child_count > 0 && (
                      <Chip
                        label={languoid.child_count}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Empty State */}
      {paginatedLanguoids.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No languoids found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || levelFilter || familyFilter || regionFilter
                ? 'Try adjusting your search criteria.'
                : 'No languoids have been added yet.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination 
            count={totalPages} 
            page={displayPage} 
            onChange={(_, page) => handlePageChange(page)}
            color="primary"
            size={isMobile ? 'small' : 'medium'}
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Container>
  );
};

export default LanguoidsList;
