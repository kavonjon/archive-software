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

### List Page State

Filter persistence, debounced filters, layout, column visibility, and cache filtering for list pages: **`04-REFERENCE/frontend/list-page-patterns.md`**

Quick reminders:
- `usePersistedListState` (sessionStorage) — filters, selection, pagination
- `usePersistedColumnVisibility` (localStorage) — Items list column prefs only
- Do not copy Languoid `page_size=10000` load-all to Items/Collaborators/Collections

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

**List page cache filtering** (batch export / filtered modes): **`04-REFERENCE/frontend/list-page-patterns.md`**

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

**Full reference:** `04-REFERENCE/frontend/list-page-patterns.md` (filters, layout, column visibility, hybrid navigation, cache filtering).

**Languoid exception:** `04-REFERENCE/frontend/languoid-list-implementation.md` — do not copy load-all client filtering to other models.

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
- `04-REFERENCE/frontend/list-page-patterns.md` - List page filters, layout, column visibility
- `accessibility.md` - ADA compliance requirements
- `batch-editors.md` - Batch editor specific patterns
- `../03-LESSONS/item-batch-editor.md` - Complex component examples
