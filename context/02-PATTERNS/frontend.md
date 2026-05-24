# Frontend Patterns (React + TypeScript)

## Component Architecture

### Never Define Components Inside Components

**Problem**: Causes DOM recreation on every render - cursor jumping, lost focus

**Wrong**:
```typescript
const ParentComponent = () => {
  const ChildComponent = () => <div>Child</div>;
  return <ChildComponent />;
};
```

**Correct**:
```typescript
const ChildComponent = () => <div>Child</div>;
const ParentComponent = () => <ChildComponent />;
```

**Why**: Component defined inside parent creates new function reference on every render - React treats it as new component type - destroys and recreates DOM - loses cursor position.

### React.memo for Stability

**Use** for components receiving frequently changing props:

```typescript
export const StableComponent = React.memo<Props>(({ data, onChange }) => {
  return <div>...</div>;
});
```

**Don't overuse**: Only when profiling shows unnecessary re-renders.

### No Callbacks During Render

**Problem**: Calling callbacks during render creates infinite loops

**Wrong**:
```typescript
const Component = ({ onValueChange, value }) => {
  return (
    <div>
      {onValueChange && onValueChange(value)} {/* BAD - render-time call */}
    </div>
  );
};
```

**Correct**:
```typescript
const Component = ({ onValueChange, value }) => {
  return (
    <TextField
      value={value}
      onChange={(e) => {
        const newValue = e.target.value;
        onValueChange?.(newValue); // GOOD - event handler
      }}
    />
  );
};
```

**Rule**: Call state-updating callbacks only in event handlers or useEffect, never in render.

---

## State Management

### useState vs useRef

**useState**: When value needs to trigger re-render
```typescript
const [count, setCount] = useState(0);
// Changing count re-renders component
```

**useRef**: When value needs to persist but NOT trigger re-render
```typescript
const sessionIds = useRef<Set<number>>(new Set());
// Changing Set doesn't re-render
// Perfect for: sessionIds, isEmptyMode, rowsRef
```

**Sync Pattern** (keep ref in sync with state):
```typescript
const rowsRef = useRef<SpreadsheetRow[]>([]);

useEffect(() => {
  rowsRef.current = rows;
}, [rows]);
```

### Filter Persistence

**Use** `usePersistedListState` hook (in `hooks/`):

```typescript
const {
  filters,
  setFilters,
  selectedIds,
  toggleSelection,
  setAllSelections,
  clearSelection,
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  clearPersistedFilters,
} = usePersistedListState({
  storageKey: 'item-list-state',
  defaultFilters: DEFAULT_FILTERS,
  defaultPage: 0,
  defaultRowsPerPage: 25,
});
```

**Benefits**:
- Persists across navigation (sessionStorage)
- Standardized API across list pages
- Automatic cleanup on clear

### Debounced Filters

**Pattern**: Separate `filters` (immediate) from `activeFilters` (debounced)

```typescript
const [filters, setFilters] = useState(DEFAULT_FILTERS);
const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);

const debouncedApplyFilters = useMemo(
  () => debounce((newFilters) => {
    setActiveFilters(newFilters);
  }, 500),
  []
);

useEffect(() => {
  debouncedApplyFilters(filters);
}, [filters, debouncedApplyFilters]);
```

**Use**:
- `filters`: Bind to input fields (immediate UI response)
- `activeFilters`: Use for API calls (debounced, reduces requests)
- `advancedFilterCount`: Count advanced filters only (exclude `keyword_contains` / search term from chip)
- `hasActiveFilters`: Include keyword for batch edit/export "filtered mode" logic
- `initialLoadComplete`: Full-page loading spinner only until first successful load; subsequent filter changes keep list visible

**Keyword search layout (standard across list pages):**
- Keywords field always visible (outside collapsible advanced panel)
- No Search button — filters apply automatically (500ms debounce on server-paginated lists)
- Languoids: instant client-side filter on `searchTerm` (load-all exception)

**Query param building (CollectionsList, ItemsList):** Arrays (multi-select) join with comma; `access_levels=,` when only "Not specified" selected. Strings trim before send. Dates send ISO `YYYY-MM-DD` from `type="date"` inputs.

```typescript
const advancedFilterCount = useMemo(() => {
  return Object.entries(activeFilters).filter(([key, value]) => {
    if (key === 'keyword_contains') return false;
    // ... count non-empty advanced fields
  }).length;
}, [activeFilters]);

const hasActiveFilters = useMemo(() => {
  return Boolean(activeFilters.keyword_contains?.trim()) || advancedFilterCount > 0;
}, [activeFilters, advancedFilterCount]);

const [initialLoadComplete, setInitialLoadComplete] = useState(false);
// Set true after first successful fetch; use loading && !initialLoadComplete for full-page spinner only
```

---

## TypeScript Patterns

### Interface Definitions

**For API responses**, define in `services/api.ts`:

```typescript
export interface Item {
  id: number;
  catalog_number: string;
  description_scope_and_content: string;  // Match backend field name
  resource_type: string;
  resource_type_display: string;
  // ... all fields
  
  // Complex relationships
  collaborators: Array<{
    id: number;
    name: string;  // Match batch serializer
    roles: string[];
    citation_author: boolean;
  }>;
  
  titles: Array<{
    id: number;
    title: string;
    language: { id: number; name: string; glottocode: string } | null;
    default: boolean;
  }>;
}
```

**Critical**: Field names MUST match backend serializer exactly.

### No 'any' Types

**Wrong**:
```typescript
const handleChange = (value: any) => { ... };
```

**Correct**:
```typescript
const handleChange = (value: string | null) => { ... };
```

**Exception**: When absolutely necessary with justification comment

### Type Guards

**Use** for narrowing union types:

```typescript
const isValidCollaborator = (
  collab: Collaborator | InvalidCollaborator
): collab is Collaborator => {
  return collab.id !== null;
};

// Usage
const validCollabs = collaborators.filter(isValidCollaborator);
```

---

## Material-UI (MUI) Patterns

### Responsive Dropdowns

**Problem**: Long option text breaks layout

**Solution**: Abbreviate via `renderValue`, show full in dropdown

```typescript
const createAbbreviatedLabel = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

<Select
  value={value}
  renderValue={(selected) => {
    const option = options.find(o => o.value === selected);
    const maxLength = isMobile ? 20 : isTablet ? 30 : 40;
    return createAbbreviatedLabel(option?.label || '', maxLength);
  }}
>
  {options.map(opt => (
    <MenuItem value={opt.value}>{opt.label}</MenuItem> // Full text
  ))}
</Select>
```

### Proper Link Components

**For navigation**, use React Router Link (not button):

```typescript
import { Link as RouterLink } from 'react-router-dom';
import { Link } from '@mui/material';

<Link
  component={RouterLink}
  to={`/items/${item.id}`}
  onClick={(e) => e.stopPropagation()} // Prevent row click
  sx={{
    fontWeight: 'medium',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' }
  }}
>
  {item.catalog_number}
</Link>
```

**Benefits**:
- Right-click context menu (open in new tab)
- Ctrl/Cmd + Click support
- Semantic HTML (<a> tags)
- SEO friendly

**Combine with** clickable rows for convenience:

```typescript
<TableRow
  hover
  onClick={() => navigate(`/items/${item.id}`)}
  sx={{ cursor: 'pointer' }}
>
  <TableCell>
    <Link component={RouterLink} to={`/items/${item.id}`} onClick={e => e.stopPropagation()}>
      {item.catalog_number}
    </Link>
  </TableCell>
  <TableCell>{item.description}</TableCell>
</TableRow>
```

### Mobile-First Responsive

**Use** MUI breakpoints:

```typescript
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));  // 0-600px
const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600-900px

<Box sx={{
  display: 'flex',
  flexDirection: isMobile ? 'column' : 'row',
  gap: isMobile ? 1 : 2,
}}>
```

**Design Strategy**:
- xs (0-600px): Card layouts, stacked forms, hamburger nav
- sm (600-900px): 2-column grids, expanded nav
- md (900-1200px): 3-column grids, table views
- lg (1200px+): Full desktop layout

---

## Async Operations

### Loading States

**Pattern**: Three states: loading, success, error

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const loadData = async () => {
  setLoading(true);
  setError(null);
  try {
    const data = await api.get('/items/');
    setItems(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

**UI**:
```typescript
{loading && <CircularProgress />}
{error && <Alert severity="error">{error}</Alert>}
{!loading && !error && <DataTable data={items} />}
```

### Polling Pattern

**Use** for async operations (cache building, exports):

```typescript
const pollUntilReady = async (
  checkFn: () => Promise<boolean>,
  maxAttempts = 30,
  interval = 2000
): Promise<boolean> => {
  for (let i = 0; i < maxAttempts; i++) {
    const ready = await checkFn();
    if (ready) return true;
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false; // Timeout
};
```

**Example**:
```typescript
const cacheReady = await pollUntilReady(async () => {
  const response = await api.get('/items/?batch=true');
  return response.status === 200;
}, 30, 2000);
```

---

## Form Patterns

### Controlled Components

**Always** for inputs in React:

```typescript
const [value, setValue] = useState('');

<TextField
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**Never**: Uncontrolled with refs (except for file inputs)

### In-Place Editing

**Pattern**: Edit icon to TextField to Save/Cancel buttons

```typescript
const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
const [editValues, setEditValues] = useState<Record<string, string>>({});

const startEdit = (fieldName: string) => {
  setEditingFields(prev => new Set(prev).add(fieldName));
  setEditValues(prev => ({ ...prev, [fieldName]: item[fieldName] || '' }));
};

const saveEdit = async (fieldName: string) => {
  await api.patch(`/items/${item.id}/`, {
    [fieldName]: editValues[fieldName]
  });
  setEditingFields(prev => {
    const next = new Set(prev);
    next.delete(fieldName);
    return next;
  });
  // Update local state
};
```

**Render**:
```typescript
{editingFields.has('description') ? (
  <Box>
    <TextField
      value={editValues.description}
      onChange={(e) => setEditValues({...editValues, description: e.target.value})}
      autoFocus
      multiline
    />
    <IconButton onClick={() => saveEdit('description')}><CheckIcon /></IconButton>
    <IconButton onClick={() => cancelEdit('description')}><CloseIcon /></IconButton>
  </Box>
) : (
  <Box>
    <Typography>{item.description || '(blank)'}</Typography>
    <IconButton onClick={() => startEdit('description')}><EditIcon /></IconButton>
  </Box>
)}
```

### Catalog Number Validation (In-Place Edit)

`catalog_number` requires real-time uniqueness checking — it's more complex than other in-place edit fields.

**Implementation**:
```typescript
const [catalogValidation, setCatalogValidation] = useState<{
  isValidating: boolean;
  isValid: boolean | null;
  error: string | null;
}>({ isValidating: false, isValid: null, error: null });

// Debounced uniqueness check (500ms)
const checkUniqueness = useCallback(
  debounce(async (value: string, currentItemId: number) => {
    if (!value.trim()) {
      setCatalogValidation({ isValidating: false, isValid: false, error: 'Required' });
      return;
    }
    setCatalogValidation({ isValidating: true, isValid: null, error: null });
    try {
      const results = await itemsAPI.list({ catalog_number: value, page_size: 1 });
      const exists = results.count > 0 && results.results[0].id !== currentItemId;
      setCatalogValidation({
        isValidating: false,
        isValid: !exists,
        error: exists ? 'Catalog number already exists' : null,
      });
    } catch {
      setCatalogValidation({ isValidating: false, isValid: false, error: 'Validation failed' });
    }
  }, 500),
  []
);
```

**Validation states** shown to user:
- `isValidating = true`: spinner + "Checking uniqueness..."
- `error` set: red error alert (required / too long / already exists / API error)
- `isValid = true`: green success message

**Save prevention**: Save button disabled when `isValidating` or `!isValid`.

**Integration**: Pass a `validationState` prop to the `EditableField` component for the catalog number field specifically. Other fields use simpler validation.

---

## Client-Side Filtering

### Pattern for List Pages

```typescript
const applyFiltersToCache = (items: Item[], filters: FilterState): Item[] => {
  return items.filter(item => {
    // Keyword filter (check multiple fields)
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      const catalogMatch = item.catalog_number?.toLowerCase().includes(keyword);
      const descMatch = item.description_scope_and_content?.toLowerCase().includes(keyword);
      const titlesMatch = item.titles?.some(t => t.title.toLowerCase().includes(keyword));
      const collabMatch = item.collaborators?.some(c => c.name.toLowerCase().includes(keyword));
      
      if (!(catalogMatch || descMatch || titlesMatch || collabMatch)) {
        return false;
      }
    }
    
    // Other filters...
    return true;
  });
};
```

**Critical**: Must check same fields as backend filter for count parity.

**Item-specific cache filters added 2026-05:**
- `language_description_type`: comma-split tokens, regex token match (mirror Genre)
- `collection_contains`: FK-derived `collection_abbr` / `collection_name` on batch serializer (not legacy CharField)
- `original_format_medium`: comma-split, exact match against valid `FORMAT_CHOICES` only

**Collaborator cache filtering:** Use shared `collaboratorMatchesActiveFilters` helper (includes `keyword_contains`, language contains, and other active filters) — do not duplicate inline filter blocks.

**Reference implementations:** `ItemsList.tsx`, `CollaboratorsList.tsx`, `CollectionsList.tsx` (server-paginated); `LanguoidsList.tsx` (client-side exception).

### Pattern for Picker Dropdowns

**Use** when dataset is 100-5000 items and search is common:

```typescript
const [allCollaborators, setAllCollaborators] = useState<Collaborator[]>([]);
const [filteredCollaborators, setFilteredCollaborators] = useState<Collaborator[]>([]);
const [searchQuery, setSearchQuery] = useState('');

// Load once when entering edit mode
useEffect(() => {
  if (editMode && allCollaborators.length === 0) {
    api.get('/collaborators/?picker=true&page_size=10000')
       .then(data => setAllCollaborators(data));
  }
}, [editMode]);

// Filter client-side as user types
useEffect(() => {
  const query = searchQuery.toLowerCase();
  const filtered = allCollaborators.filter(collab =>
    collab.full_name.toLowerCase().includes(query)
  );
  setFilteredCollaborators(filtered);
}, [searchQuery, allCollaborators]);
```

**Backend** (ultra-light picker serializer):
```python
class CollaboratorPickerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collaborator
        fields = ['id', 'full_name']  # Minimal

# In ViewSet
def get_serializer_class(self):
    if self.request.query_params.get('picker') == 'true':
        return CollaboratorPickerSerializer
    if self.request.query_params.get('batch') == 'true':
        return CollaboratorBatchSerializer
    return CollaboratorSerializer
```

**Benefits**: Zero latency, no race conditions, instant results.

---

## React Hooks

### Custom Hooks

**usePageTitle** - Dynamic page titles:
```typescript
const usePageTitle = (title: string) => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `NAL Archive | ${title}`;
    return () => { document.title = prevTitle; };
  }, [title]);
};

// Usage
usePageTitle('Items');
```

**usePersistedListState** - Filter/pagination persistence:
```typescript
// See Filter Persistence section
```

**useImportSpreadsheet** - Import logic:
```typescript
// Model-specific, see item-batch-editor.md
```

### Effect Cleanup

**Always** clean up timers, listeners, debounced functions:

```typescript
useEffect(() => {
  const timer = setTimeout(() => { ... }, 1000);
  return () => clearTimeout(timer);
}, []);

useEffect(() => {
  return () => debouncedFn.cancel();
}, [debouncedFn]);
```

---

## Error Handling

### Try-Catch for Async

**Pattern**:
```typescript
const handleSave = async () => {
  try {
    setLoading(true);
    await api.post('/items/', data);
    showSuccessMessage('Item saved');
  } catch (error) {
    if (error instanceof APIError) {
      showErrorMessage(error.message);
    } else {
      showErrorMessage('An unexpected error occurred');
    }
  } finally {
    setLoading(false);
  }
};
```

### User-Friendly Messages

**Map API errors** to friendly messages:

```typescript
const getErrorMessage = (error: APIError): string => {
  if (error.status === 400) {
    return error.details?.field 
      ? `Invalid ${error.details.field}: ${error.message}`
      : 'Please check your input';
  }
  if (error.status === 403) {
    return 'You do not have permission for this action';
  }
  if (error.status === 404) {
    return 'Record not found';
  }
  return 'An error occurred. Please try again.';
};
```

---

## List Page Patterns

### Languoid List — SPECIAL CASE (PM-Approval Required)

**WARNING**: The Languoid list page uses a different loading strategy than Item and Collaborator lists. Do NOT copy this pattern to other models without PM approval.

**Languoid-specific strategy**: Load ALL records at once (`page_size=10000`) and filter client-side. This is justified because:
1. The tree hierarchy requires all nodes to be available for parent/child display
2. Smart pagination at family tree boundaries is the UX goal
3. 1,200 languoids is a manageable dataset

**Deep dive:** `04-REFERENCE/frontend/languoid-list-implementation.md` (tree fix, smart pagination, scroll behavior).

**Anti-pattern**: Applying `page_size=10000` load-all client-side filtering to Items (4,400 rows) or Collaborators (7,400 rows) would cause serious performance problems. These models use server-side pagination and Redis-cached batch loading.

```typescript
// Languoid list - ONLY for languoid list page
const languoids = await api.get('/languoids/?page_size=10000');

// Item/Collaborator lists - server-side pagination (standard)
const items = await api.get('/items/?page=1&page_size=25');
```

```typescript
const ItemsList = () => {
  usePageTitle('Items');
  
  const { user } = useAuth();
  const {
    filters, setFilters,
    selectedIds, toggleSelection,
    page, setPage,
    rowsPerPage, setRowsPerPage,
    clearPersistedFilters
  } = usePersistedListState({...});
  
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
  const [items, setItems] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Debounced filter application
  const debouncedApplyFilters = useMemo(() => 
    debounce((newFilters) => setActiveFilters(newFilters), 500),
    []
  );
  
  // Load data
  useEffect(() => {
    loadItems();
  }, [activeFilters, page, rowsPerPage]);
  
  return (
    <Container>
      <Typography variant="h4">Items</Typography>
      
      {/* Filters */}
      <FilterSection />
      
      {/* Results count */}
      <Typography variant="body2" color="text.secondary">
        {totalCount.toLocaleString()} item{totalCount !== 1 ? 's' : ''} found
      </Typography>
      
      {/* Table */}
      <DataTable />
      
      {/* Pagination */}
      <TablePagination />
      
      {/* Batch actions */}
      <ItemBatchEditButton />
      <ItemExportButton />
    </Container>
  );
};
```

### Standard List Page Filter Layout (2026-05)

**Applies to:** Items, Collaborators, Collections (server-paginated). Languoids uses same keyword UX but client-side filtering.

```
[ Title + count ]
[ Keywords (always visible)                    ]
[ Show/Hide Filters (N) ]  [ Clear ]
[ Advanced filter grid — collapsible             ]
[ Results: "X items found"                       ]
[ Table + pagination                             ]
[ Export | Batch Edit ]  (Collections: Export only — no batch editor yet)
```

**CollectionsList (2026-05-23):** Uses `usePersistedListState` (`collection-list-state-v4`), debounced `activeFilters`, results count, and `initialLoadComplete`. Multi-select filters (`genres`, `access_levels`) use `string[]` state; date range uses From/To `type="date"` fields matching Items. `CollectionExportButton` provides client-side CSV export (filtered or selected); no batch edit until Collection batch editor exists.

### Hybrid Navigation

**Pattern**: React Router links on identifiers + clickable rows

```typescript
<TableRow
  hover
  onClick={() => navigate(`/items/${item.id}`)}
  sx={{ cursor: 'pointer' }}
>
  <TableCell>
    {/* Link with stopPropagation */}
    <Link
      component={RouterLink}
      to={`/items/${item.id}`}
      onClick={(e) => e.stopPropagation()}
    >
      {item.catalog_number}
    </Link>
  </TableCell>
  <TableCell>{item.description}</TableCell>
</TableRow>
```

**Benefits**: Right-click, Ctrl+Click, middle-click all work for power users.

---

## Performance Optimization

### useMemo for Expensive Computations

```typescript
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => 
    a.catalog_number.localeCompare(b.catalog_number)
  );
}, [items]);
```

**Don't overuse**: Only for computationally expensive operations.

### useCallback for Stable Functions

```typescript
const handleItemClick = useCallback((id: number) => {
  navigate(`/items/${id}`);
}, [navigate]);
```

**Use when**: Passing callbacks to memoized children.

### Virtual Scrolling

**Not currently used** in batch editors (TanStack Table handles 4000+ rows fine).

**Consider** if performance issues with >10,000 rows.

---

## Common Pitfalls

### Stale Closures

**Problem**: Event handler references old state

**Solution**: Use useRef or latest state in useCallback deps

```typescript
// WRONG
const handleClick = () => {
  console.log(count); // Stale if count changes
};

// CORRECT
const handleClick = useCallback(() => {
  console.log(count); // Fresh
}, [count]);
```

### Missing Dependencies

**ESLint** warns about missing useEffect dependencies - fix them:

```typescript
// Warnings mean bugs
useEffect(() => {
  loadData(filters); // filters should be in deps
}, []); // Missing filters

// Fixed
useEffect(() => {
  loadData(filters);
}, [filters]); // Complete deps
```

### Unhandled Promises

```typescript
// WRONG
const handleSave = () => {
  api.post('/items/', data); // Unhandled promise
};

// CORRECT
const handleSave = async () => {
  try {
    await api.post('/items/', data);
  } catch (error) {
    handleError(error);
  }
};
```

---

## Code Organization

### Component Files

**Structure**:
```typescript
// Imports
import React, { useState, useEffect } from 'react';
import { Box, Button } from '@mui/material';

// Interfaces
interface Props {
  itemId: number;
  onSave: (item: Item) => void;
}

// Component
export const ItemEditor: React.FC<Props> = ({ itemId, onSave }) => {
  // Hooks
  const [item, setItem] = useState<Item | null>(null);
  
  // Effects
  useEffect(() => { ... }, [itemId]);
  
  // Handlers
  const handleSave = async () => { ... };
  
  // Render
  return ( ... );
};
```

### Import Organization

**Order**:
1. React imports
2. Third-party libraries (MUI, lodash, etc.)
3. Internal utilities and types
4. Internal components
5. Styles (if any)

**Example**:
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { debounce } from 'lodash';

import { Item } from '../types';
import { itemsAPI } from '../services/api';
import { DataTable } from '../components/common/DataTable';
```

---

## Testing Patterns

### Manual Testing Checklist

**For each component**:
- [ ] Loads without errors
- [ ] Displays data correctly
- [ ] Handles loading state
- [ ] Handles error state
- [ ] Handles empty state
- [ ] Responsive on mobile (320px)
- [ ] Keyboard navigation works
- [ ] No axe-core violations

**For forms**:
- [ ] Validation works
- [ ] Error messages clear
- [ ] Success feedback provided
- [ ] Focus management correct

---

## Authentication UX Patterns

### Login Flow

```
Unauthenticated user hits protected route
    -> ProtectedRoute component intercepts
    -> Saves current location as state.from
    -> Redirects to /login
    -> After successful login, navigate to state.from (or /items as default)
```

**Implementation**:
```typescript
// ProtectedRoute
const location = useLocation();
if (!isAuthenticated) {
  return <Navigate to="/login" state={{ from: location }} replace />;
}

// After login success
const from = (location.state as any)?.from?.pathname || '/items';
navigate(from, { replace: true });
```

**Default redirect**: `/items` (when no `state.from` saved)

---

## Map / Geographic Features

**Implementation notes (Item/Languoid maps, validation, Nominatim):** `04-REFERENCE/frontend/geographic-features.md`

### Leaflet Icon Fix

Leaflet's default marker icons are broken in React builds due to webpack asset handling. This is fixed in `leafletConfig.ts`:

```typescript
// frontend/src/leafletConfig.ts
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl: iconUrl,
  shadowUrl: iconShadowUrl,
});
```

**Import this file** once at the app entry point. Without it, markers show as broken images.

---

## Specific UI Components

### Footer

`Footer.tsx` is displayed **on the home page only** (not on internal app pages).

**Contents**: NEH funding acknowledgment, WCAG compliance badge, contact information.

**Pattern**: Render conditionally in the root layout based on current route.

### Favicon and PWA

The project has favicon and PWA manifest configured. When updating favicon or icons:
- Update `public/favicon.ico`
- Update `public/manifest.json` (PWA metadata)
- Update `public/index.html` (meta tags)

### In-App User Guide

The app has an in-app help/user guide rendered with ReactMarkdown.

**Dependencies**: `remark-gfm` plugin is required for GitHub Flavored Markdown (tables, strikethrough, etc.)

```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {markdownContent}
</ReactMarkdown>
```

**Content location**: User guide markdown lives in `docs/user-guide/`. These files are PM-triggered only — never write them proactively.

---

**See also**:
- `accessibility.md` - ADA compliance requirements
- `batch-editors.md` - Batch editor specific patterns
- `../03-LESSONS/item-batch-editor.md` - Complex component examples
