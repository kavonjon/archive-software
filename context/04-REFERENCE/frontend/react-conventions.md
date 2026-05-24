# React conventions (reference)

**Context note (2026-05-24):** Hooks, error handling, performance, pitfalls, file organization, and manual testing checklists. Stable patterns applicable across frontend components.

**See also:** Component architecture and state basics in `02-PATTERNS/frontend.md`.

---

## Custom hooks

**usePageTitle** — dynamic page titles:
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

**usePersistedListState** — filter/pagination persistence: see `list-page-patterns.md`

**useImportSpreadsheet** — import logic: model-specific, see `03-LESSONS/item-batch-editor.md`

### Effect cleanup

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

## Error handling

### Try-catch for async

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

### User-friendly messages

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

## Performance optimization

### useMemo for expensive computations

```typescript
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => 
    a.catalog_number.localeCompare(b.catalog_number)
  );
}, [items]);
```

**Don't overuse**: Only for computationally expensive operations.

### useCallback for stable functions

```typescript
const handleItemClick = useCallback((id: number) => {
  navigate(`/items/${id}`);
}, [navigate]);
```

**Use when**: Passing callbacks to memoized children.

### Virtual scrolling

**Not currently used** in batch editors (TanStack Table handles 4000+ rows fine).

**Consider** if performance issues with >10,000 rows.

---

## Common pitfalls

### Stale closures

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

### Missing dependencies

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

### Unhandled promises

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

## Code organization

### Component files

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

### Import organization

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

## Manual testing checklist

**For each component**:
- Loads without errors
- Displays data correctly
- Handles loading state
- Handles error state
- Handles empty state
- Responsive on mobile (320px)
- Keyboard navigation works
- No axe-core violations

**For forms**:
- Validation works
- Error messages clear
- Success feedback provided
- Focus management correct
