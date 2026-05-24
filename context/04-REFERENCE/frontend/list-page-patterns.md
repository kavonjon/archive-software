# List page patterns (reference)

**Context note (2026-05-24):** Server-paginated list pages (Items, Collaborators, Collections) and the Languoid list exception. **Primary code:** `ItemsList.tsx`, `CollaboratorsList.tsx`, `CollectionsList.tsx`, `LanguoidsList.tsx`.

**See also:** General React/TS/MUI patterns in `02-PATTERNS/frontend.md`. Languoid-only tree/load-all details in `languoid-list-implementation.md`.

---

## Filter persistence

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

**Storage key examples:** `item-list-state`, `collaborator-list-state`, `collection-list-state-v4`

---

## Debounced filters

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

## Client-side cache filtering (batch export / filtered modes)

When batch edit or export operates on "filtered" results, client-side filtering of the Redis/cache dataset must mirror backend filters for count parity.

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

---

## Languoid list — SPECIAL CASE (PM approval required)

**WARNING**: The Languoid list page uses a different loading strategy than Item and Collaborator lists. Do NOT copy this pattern to other models without PM approval.

**Languoid-specific strategy**: Load ALL records at once (`page_size=10000`) and filter client-side. This is justified because:
1. The tree hierarchy requires all nodes to be available for parent/child display
2. Smart pagination at family tree boundaries is the UX goal
3. 1,200 languoids is a manageable dataset

**Deep dive:** `languoid-list-implementation.md` (tree fix, smart pagination, scroll behavior).

**Anti-pattern**: Applying `page_size=10000` load-all client-side filtering to Items (4,400 rows) or Collaborators (7,400 rows) would cause serious performance problems. These models use server-side pagination and Redis-cached batch loading.

```typescript
// Languoid list - ONLY for languoid list page
const languoids = await api.get('/languoids/?page_size=10000');

// Item/Collaborator lists - server-side pagination (standard)
const items = await api.get('/items/?page=1&page_size=25');
```

---

## Standard list page structure

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

### Standard filter layout (2026-05)

**Applies to:** Items, Collaborators, Collections (server-paginated). Languoids uses same keyword UX but client-side filtering.

```
[ Title + count ]
[ Keywords (always visible)                    ]
[ Show/Hide Filters (N) ]  [ Clear ]
[ Advanced filter grid — collapsible             ]
[ Results: "X items found"          [Columns ≡] ]  ← Items desktop only
[ Table + pagination                             ]
[ Export | Batch Edit ]  (Collections: Export only — no batch editor yet)
```

**CollectionsList (2026-05-23):** Uses `usePersistedListState` (`collection-list-state-v4`), debounced `activeFilters`, results count, and `initialLoadComplete`. Multi-select filters (`genres`, `access_levels`) use `string[]` state; date range uses From/To `type="date"` fields matching Items. `CollectionExportButton` provides client-side CSV export (filtered or selected); no batch edit until Collection batch editor exists.

---

## Item list column visibility (2026-05-24)

**Applies to:** Items list desktop table only (`ItemsList.tsx`, `!isMobile`). Mobile card layout unchanged.

**Do not confuse with batch editor column config** (`ITEM_COLUMNS` in `ItemBatchEditor.tsx`) — list columns are a separate system for read-only table display.

**Components:**

| Piece | Role |
|---|---|
| `usePersistedColumnVisibility` | `localStorage` read/write; versioned blob `{ version, visible: id[] }` |
| `ColumnVisibilityMenu` | Popover; hamburger trigger; grouped checkboxes |
| `itemListColumns.tsx` | `ITEM_LIST_COLUMNS`, `ITEM_LIST_COLUMN_GROUPS`, `ITEM_LIST_DETAIL_FIELD_ORDER` |
| `itemListColumnHelpers.tsx` | Cell renderers; `truncatedTextSx` / `truncatedChipSx` |

**Storage keys (Items):**

| Key | Storage | Contents |
|---|---|---|
| `item-list-state` | sessionStorage | Filters, selection, pagination |
| `item-list-visible-columns` | localStorage | Column visibility (version **2**) |

**Picker UX:** Sticky header inside Popover — "Columns" title + "Reset to default" text button (top right); scrollable grouped checklist below; reset does not close menu.

**Rendering rules:** Map `visibleColumns` over `ITEM_LIST_COLUMNS` for header/body; dynamic `colSpan`; `table-layout: auto` (no fixed data-column widths). Catalog # `hideable: false`.

**Group order (picker):** Titles → Collection Information → Item Details → Description → Languages and Dialects → Collaborators → Important Dates → Tags → Browse Categories → Access & Permissions → Accessions → Condition → Location → Coordinates → Digitization → Books → External → Metadata History. Matches visual reading order on `ItemDetail.tsx`.

**Reuse on other list pages:** `ColumnVisibilityMenu` + `usePersistedColumnVisibility` are generic; column defs stay per-model (e.g. do not share `itemListColumns` with Collections until a dedicated config exists).

---

## Hybrid navigation (table rows)

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

## Related files

| Concern | Location |
|---|---|
| Filter persistence hook | `frontend/src/hooks/usePersistedListState.ts` |
| Column visibility hook | `frontend/src/hooks/usePersistedColumnVisibility.ts` |
| Column menu component | `frontend/src/components/list/ColumnVisibilityMenu.tsx` |
| Item column defs | `frontend/src/components/items/itemListColumns.tsx` |
| Backend list filters | `02-PATTERNS/backend.md` (FilterSet patterns) |
| Batch editor columns (separate system) | `02-PATTERNS/batch-editors.md` |
