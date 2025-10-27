import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { languoidsAPI, type Languoid, LANGUOID_LEVEL_CHOICES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { hasEditAccess } from '../../utils/permissions';

// Level filter presets
const LEVEL_FILTER_PRESETS = [
  { key: 'all', label: 'All Languoids', levels: [] },
  { key: 'languages', label: 'Languages Only', levels: ['language'] },
  { key: 'dialects', label: 'Dialects Only', levels: ['dialect'] },
  { key: 'languages_dialects', label: 'Languages & Dialects', levels: ['language', 'dialect'] },
  { key: 'families', label: 'Families Only', levels: ['family'] },
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Data state
  const [languoids, setLanguoids] = useState<Languoid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Load languoids with hierarchical ordering
  const loadLanguoids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {
        page: page.toString(),
        page_size: pageSize.toString(),
        hierarchical: 'true', // Enable hierarchical ordering
      };

      // Apply level preset filter
      const preset = LEVEL_FILTER_PRESETS.find(p => p.key === selectedLevelFilter);
      if (preset && preset.levels.length > 0) {
        // For multiple levels, we'll filter on the frontend since DRF doesn't support OR queries easily
        // But we can still pass a single level to the backend if it's just one
        if (preset.levels.length === 1) {
          params.level_nal = preset.levels[0];
        }
      }

      // Apply search and other filters
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (levelFilter) {
        params.level_nal = levelFilter;
      }
      if (familyFilter.trim()) {
        params.family__icontains = familyFilter.trim();
      }
      if (regionFilter.trim()) {
        params.region__icontains = regionFilter.trim();
      }

      const response = await languoidsAPI.list(params);
      
      // Apply frontend filtering for multi-level presets
      let filteredResults = response.results;
      if (preset && preset.levels.length > 1) {
        filteredResults = response.results.filter(languoid => 
          preset.levels.includes(languoid.level_nal)
        );
      }

      setLanguoids(filteredResults);
      setTotalCount(response.count);
    } catch (err) {
      console.error('Error loading languoids:', err);
      setError('Failed to load languoids. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, selectedLevelFilter, searchTerm, levelFilter, familyFilter, regionFilter]);

  // Build hierarchical display with indentation
  const hierarchicalLanguoids = useMemo((): HierarchicalLanguoid[] => {
    const result: HierarchicalLanguoid[] = [];
    const processed = new Set<number>();

    // Helper function to add languoid and its children recursively
    const addLanguoidWithChildren = (languoid: Languoid, indentLevel: number = 0) => {
      if (processed.has(languoid.id)) return;
      
      processed.add(languoid.id);
      result.push({ ...languoid, indentLevel });

      // Find and add children (languoids that have this one as parent)
      const children = languoids.filter(l => 
        !processed.has(l.id) && (
          l.parent_languoid === languoid.id ||
          l.family_languoid === languoid.id ||
          l.language_languoid === languoid.id
        )
      ).sort((a, b) => a.name.localeCompare(b.name));

      children.forEach(child => {
        addLanguoidWithChildren(child, indentLevel + 1);
      });
    };

    // Start with families (top level)
    const families = languoids.filter(l => l.level_nal === 'family').sort((a, b) => a.name.localeCompare(b.name));
    families.forEach(family => addLanguoidWithChildren(family, 0));

    // Add any orphaned languoids (those without proper parent relationships)
    const orphans = languoids.filter(l => !processed.has(l.id)).sort((a, b) => a.name.localeCompare(b.name));
    orphans.forEach(orphan => addLanguoidWithChildren(orphan, 0));

    return result;
  }, [languoids]);

  // Load data on component mount and when filters change
  useEffect(() => {
    loadLanguoids();
  }, [loadLanguoids]);

  const handleRowClick = (languoid: Languoid) => {
    navigate(`/languages/${languoid.id}`);
  };

  const handleCreateClick = () => {
    navigate('/languages/create');
  };

  const handleLevelFilterChange = (filterKey: string) => {
    setSelectedLevelFilter(filterKey);
    setPage(1); // Reset to first page
  };

  const clearFilters = () => {
    setSearchTerm('');
    setLevelFilter('');
    setFamilyFilter('');
    setRegionFilter('');
    setSelectedLevelFilter('all');
    setPage(1);
  };

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

      {/* Results Count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Showing {hierarchicalLanguoids.length} of {totalCount} languages
      </Typography>

      {/* Hierarchical Table/List */}
      {isMobile ? (
        // Mobile: Card layout
        <Stack spacing={2}>
          {hierarchicalLanguoids.map((languoid) => (
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
                  {languoid.family && (
                    <Typography variant="body2" color="text.secondary">
                      Family: {languoid.family}
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
              {hierarchicalLanguoids.map((languoid) => (
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
                  <TableCell>{languoid.family || '—'}</TableCell>
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
      {hierarchicalLanguoids.length === 0 && !loading && (
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

      {/* Pagination would go here if needed */}
    </Container>
  );
};

export default LanguoidsList;
