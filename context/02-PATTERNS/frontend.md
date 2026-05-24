# Frontend Patterns (React + TypeScript)

Core patterns for day-to-day frontend work. Stable deep dives live in **`04-REFERENCE/frontend/`** (list pages, forms, React conventions, app shell, geographic).

---

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

**Table rows + links:** See `04-REFERENCE/frontend/list-page-patterns.md` (hybrid navigation).

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

In-place editing, catalog validation, controlled inputs, FK picker dropdowns: **`04-REFERENCE/frontend/form-patterns.md`**

---

## List Page Patterns

**Full reference:** `04-REFERENCE/frontend/list-page-patterns.md` (filters, layout, column visibility, hybrid navigation, cache filtering).

**Languoid exception:** `04-REFERENCE/frontend/languoid-list-implementation.md` — do not copy load-all client filtering to other models.

---

## React Conventions

Hooks, error handling, performance, pitfalls, file organization, testing checklists: **`04-REFERENCE/frontend/react-conventions.md`**

---

## App Shell

Authentication flow, footer, favicon/PWA, in-app user guide: **`04-REFERENCE/frontend/app-shell-patterns.md`**

---

## Map / Geographic Features

**Full reference:** `04-REFERENCE/frontend/geographic-features.md` (coordinates, Leaflet, validation, Nominatim).

---

**See also**:
- `04-REFERENCE/frontend/list-page-patterns.md` - List page filters, layout, column visibility
- `04-REFERENCE/frontend/form-patterns.md` - In-place editing, pickers
- `04-REFERENCE/frontend/react-conventions.md` - Hooks, errors, testing
- `04-REFERENCE/frontend/app-shell-patterns.md` - Auth, footer, user guide
- `accessibility.md` - ADA compliance requirements
- `batch-editors.md` - Batch editor specific patterns
- `../03-LESSONS/item-batch-editor.md` - Complex component examples
