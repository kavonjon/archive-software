# Batch Editor Patterns

**Reference Implementation**: Item batch editor (60 fields, 4,400 rows)  
**Comprehensive Docs**: `../03-LESSONS/item-batch-editor.md`  
**Validation flows (canonical, Mermaid):** `docs/system-behavior/batch-editor/validation.md` — live edit / import / save; Languoid vs Collaborator vs Item differences. Update that file when changing validation behavior (not duplicated here).

## Validation (three layers — intentional design)

Tiered validation is **by design**, not tech debt: fast client feedback on live edit, backend checks on import, serializer authority on save. Do not “unify” Item live edit with Languoid’s debounced `validate-field` without a documented performance/UX goal.

| Layer | When | Authority |
|-------|------|-----------|
| Live edit | `handleCellChange` then `validateField` | Client rules; Languoid also debounces `POST …/validate-field/`; Item/Collaborator defer live backend (scale + composite fields) |
| Import | Parsers then `useImport*Spreadsheet` | Parser errors + backend `validate-field` (per-model skip lists for virtual/M2M display fields) |
| Save | `hasErrors` gate then `save-batch` | Full `Internal*Serializer.is_valid` + conflict detection |

**Item import skip backend:** `primary_title`, `secondary_title`, `collaborators`, `language`. **Collaborator import skip:** `native_languages`, `other_languages`.

**Optional UX improvements** (not correctness blockers): client lat/lng range checks, map `save-batch` errors to cells, batch validate API — see `validation.md` § Optional enhancements.

**Diagram maintenance:** Keep graphs under ~12 nodes; use `flowchart TD` and `%%{init: {'flowchart': {'curve': 'linear'}}}%%` — see authoring rules in `validation.md`.

## 6 Universal Patterns (Mandatory for All Batch Editors)

### 1. Session Persistence

**What**: Track rows across refreshes using `useRef<Set<number>>`

**Why**: New rows must persist after save, maintain session across refreshes

**Implementation**:
```typescript
const sessionIds = useRef<Set<number>>(new Set());
const isEmptyMode = useRef<boolean>(false);

// Initialize from config
sessionIds.current = new Set(config.ids);

// Add new IDs after save
savedIds.forEach(id => sessionIds.current.add(id));

// Filter on refresh
const sessionRows = allRows.filter(r => sessionIds.current.has(r.id));
```

### 2. Order-Preserving Refresh

**What**: Maintain row order across refreshes (don't resort)

**Why**: Users expect rows to stay where they put them

**Implementation**:
```typescript
// Create lookup map
const freshDataMap = new Map(allFreshRows.map(r => [r.id, r]));

// Iterate existing order
const newRows: SpreadsheetRow[] = [];
for (const currentRow of rowsRef.current) {
  if (currentRow.isDraft && preserveDrafts) {
    newRows.push(currentRow);
  } else if (sessionIds.current.has(currentRow.id)) {
    const freshRow = freshDataMap.get(currentRow.id);
    if (freshRow) newRows.push(modelToRow(freshRow));
  }
}
```

### 3. Three Batch Edit Modes

**What**: selected, filtered, empty modes with distinct workflows

**Config Format**:
```typescript
interface BatchConfig {
  mode: 'selected' | 'filtered' | 'empty';
  ids: number[];
  timestamp: number;
}

// Store in sessionStorage
sessionStorage.setItem('{model}-batch-config', JSON.stringify(config));
```

**Mode Behaviors**:
- **selected**: User chose specific rows (checkboxes) - No warning
- **filtered**: User applied filters - Warning if no active filters
- **empty**: Start with blank grid - No warning, no initial rows

### 4. Warning Dialogs

**What**: Warn only for filtered mode without active filters

**Logic**:
```typescript
// NEVER warn for selected or empty
if (mode === 'selected' || mode === 'empty') return null;

// Check for active filters (exclude preset)
const hasActiveFilters = Object.entries(filters).some(([key, value]) => 
  key !== 'preset' && value !== null && value !== ''
);

// Warn only if filtered with no active filters
if (mode === 'filtered' && !hasActiveFilters) {
  showWarningDialog();
}
```

### 5. Cell Editor Pagination

**What**: Standard page_size=200 for relationship and multiselect editors

**Why**: Allow scrolling through substantial filtered results without pagination UI

**Implementation**:
```typescript
// In CellEditor.tsx - relationship cell type
url.searchParams.append('page_size', '200');

// In CellEditor.tsx - multiselect cell type
url.searchParams.append('page_size', '200');
```

### 6. Import Value Comparison

**What**: Robust comparison to detect actual changes (not false positives)

**Key Rules**:
```typescript
// Use ?? not || (preserves false, 0)
value: collaborator.anonymous ?? ''  // NOT collaborator.anonymous || ''

// Compare booleans before string conversion
if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;

// Case-insensitive text comparison
String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

// null/undefined/empty equivalence
if ((a === null || a === undefined || a === '') && 
    (b === null || b === undefined || b === '')) return true;
```

**Field Type Map Completeness**:
- ALL editable fields must be in fieldTypeMap
- Missing fields to undefined to false positive changes

---

## Architecture Patterns

### Redis Caching (Mandatory for >1000 Rows)

**When**: Any model with >1000 rows or >5MB cache payload

**Implementation**:

**Backend** (`app/internal_api/views.py`):
```python
def list(self, request, *args, **kwargs):
    if request.query_params.get('batch') != 'true':
        return super().list(request, *args, **kwargs)
    
    # Check cache
    cache_key = 'item_list_full'
    cached = cache.get(cache_key)
    
    if cached:
        return Response(json.loads(cached))
    
    # Cache miss - trigger rebuild
    warm_item_list_cache.apply_async(priority=8)
    return Response({'message': 'Cache building...'}, status=202)
```

**Celery Task**:
```python
@shared_task(bind=True, max_retries=3)
def warm_item_list_cache(self):
    queryset = Item.objects.all()
    queryset = queryset.prefetch_related('language', 'title_item', ...)
    queryset = queryset.order_by(Lower('catalog_number'))
    
    serializer = InternalItemBatchSerializer(queryset, many=True)
    cache.set('item_list_full', json.dumps(serializer.data), 3600)
```

**Frontend** (Cache Context):
```typescript
const getItems = async (forceRefresh = false): Promise<Item[]> => {
  if (!forceRefresh && cachedItems) return cachedItems;
  
  const response = await api.get('/items/?batch=true');
  
  if (response.status === 202) {
    // Cache building - poll until ready
    await pollUntilCacheReady();
    return await getItems(true);
  }
  
  setCachedItems(response.data);
  return response.data;
};
```

**Performance**:
- Cache build: 15-20 seconds (one-time)
- Cache hit: <1 second
- TTL: 1 hour (auto-refresh on model save)

### Async Export (>100 Rows)

**Pattern**: UUID backend, timestamp frontend

**Backend**:
```python
if len(ids) > 100:
    # Async export
    export_id = str(uuid.uuid4())
    generate_item_export_task.apply_async(
        args=[export_id, ids, request.user.id],
        priority=10
    )
    return Response({'export_id': export_id, 'async': True})
else:
    # Sync export
    file_path = generate_sync_export(ids)
    return FileResponse(open(file_path, 'rb'), ...)
```

**Frontend**:
```typescript
if (response.async) {
  // Poll every 2 seconds, 60 second timeout
  const status = await pollExportStatus(exportId);
  
  if (status.status === 'ready') {
    // Generate timestamp filename
    const timestamp = formatDate(new Date(), 'YYYY-MM-DD_HHmmss');
    const filename = `items_export_${timestamp}.xlsx`;
    
    downloadFile(status.file_url, filename);
  }
}
```

### Two Serializers Per Model

**Full Serializer** (Detail/Create/Update):
- All fields including computed fields
- Display values for choice fields (`field_display`)
- Verbose related object data
- Example: `InternalItemSerializer` (~90 fields)

**Batch Serializer** (List/Cache):
- Minimal fields for performance
- **MUST include ALL fields needed for client-side filtering**
- Exclude verbose computed fields
- Example: `InternalItemBatchSerializer` (~65 fields)

**Critical**: If client-side filter needs a field, batch serializer MUST include it.

**Example Issue**: Item filter searches titles, but batch serializer didn't include `titles` array - frontend couldn't replicate backend filter - count discrepancy (697 vs 685).

**Example Issue (2026-05)**: Item collection filter uses FK (`collection__name`, `collection__collection_abbr`), but batch serializer exposed legacy `collection_name` CharField — cache filter could not mirror backend. Fix: expose FK-derived read-only `collection_name` / `collection_abbr` on `InternalItemBatchSerializer`; frontend `applyFiltersToCache` uses those fields only.

### Picker Serializer Isolation

For FK dropdown pickers (e.g., collaborator picker on Item detail), a separate lightweight **PickerSerializer** is needed. It **must not** touch the batch serializer.

**Isolation checklist** (violations break the batch editor):
- Use `picker=true` query parameter — NOT `batch=true`
- Create a **new** `InternalXxxPickerSerializer` — do NOT modify `InternalXxxBatchSerializer`
- Use a **separate cache key** if caching (e.g., `_picker_list` not `_list_full`)
- Add comments in the ViewSet documenting the separation
- Verify `batch=true` still returns the BatchSerializer after adding picker support

**ViewSet pattern**:
```python
def get_serializer_class(self):
    if self.request.query_params.get('batch') == 'true':
        return InternalItemBatchSerializer   # batch editor - DO NOT TOUCH
    if self.request.query_params.get('picker') == 'true':
        return InternalItemPickerSerializer  # lightweight picker - separate
    return InternalItemSerializer
```

**Frontend loading strategy**: Load picker data only when entering edit mode (not on page load) to avoid wasting bandwidth if the user never edits. Use `?picker=true&page_size=10000` to get the full list in one lightweight call, then filter client-side.

**When appropriate**: Dataset is hundreds to low thousands of objects, each object serializes to < 100 bytes, total payload < 1–2 MB.

### Client-Side Filtering

**Pattern**: Operate on full cached dataset, not paginated state

**Implementation**:
```typescript
// WRONG - uses paginated state (only 25 rows)
const filtered = items.filter(item => matchesFilter(item));

// CORRECT - uses full cache
const allCachedItems = await getItems();
const filtered = allCachedItems.filter(item => matchesFilter(item));
const ids = filtered.map(i => i.id);
```

**Applies To**:
- Export (send filtered IDs to backend)
- Batch edit (load filtered IDs into editor)
- Any "filtered" operation

**Filter Parity Requirement**:
- Frontend `applyFiltersToCache` MUST check same fields as backend `FilterBackend`
- Example: Backend checks `title_item__title__icontains` - Frontend must check `item.titles` array

---

## Custom Cell Editors

**MultiSelect / multi-step-in-one-session cells:** ReactGrid exits edit mode if chip edits trigger re-renders that steal focus. Use the **static Map + forceUpdate** pattern documented in `../03-LESSONS/multiselect-cell-reactgrid.md`.

### When Needed

**Through-Models with Attributes**:
- Example: CollaboratorRole (multiselect roles + boolean citation)
- Component: CollaboratorRolesCellEditor

**Text + FK Composite**:
- Example: ItemTitle (title text + language FK)
- Component: TitleWithLanguageCellEditor

**Complex Validation**:
- Example: Unique catalog_number (check batch + cache)

### Custom Editor Pattern

**Interface**:
```typescript
interface CustomEditorProps {
  cell: { value: ComplexValue; id: string };
  onCommit: (newValue: ComplexValue, displayText: string) => void;
  onCancel: () => void;
  metadata: { options: Option[] };
}
```

**Requirements**:
- autoFocus on mount
- Handle Enter (commit if valid) and Escape (cancel)
- Compare original vs current (don't commit if unchanged)
- Visual feedback for invalid data (red styling)
- Block commit if invalid data remains

**State Management**:
```typescript
const [localValue, setLocalValue] = useState<ComplexValue>(cell.value);
const [hasChanges, setHasChanges] = useState(false);

useEffect(() => {
  const changed = !areValuesEqual(cell.value, localValue);
  setHasChanges(changed);
}, [localValue, cell.value]);
```

### Registering Custom Cell Type

**1. Define in spreadsheet.ts**:
```typescript
export type CellType = 
  | 'text' | 'select' | 'multiselect' | 'boolean' | 'relationship'
  | 'collaborator_roles'  // Custom
  | 'title_with_language'; // Custom
```

**2. Map in CellEditor.tsx**:
```typescript
if (cellType === 'collaborator_roles') {
  return <CollaboratorRolesCellEditor {...props} />;
}
```

**3. Clipboard serialization** in TanStackSpreadsheet.tsx:
```typescript
// serializeCellForClipboard
if (column.cellType === 'collaborator_roles') {
  return JSON.stringify(value); // Structured
}

// deserializeCellFromClipboard
if (column.cellType === 'collaborator_roles') {
  return JSON.parse(text); // Parse back
}
```

---

## Invalid Data Preservation

**Problem**: User imports data with typos - Old approach silently dropped - User confused

**Solution**: Preserve with `id: null`, visualize as red, allow correction

### Implementation Steps

**1. Parser** (when lookup fails):
```typescript
const languoid = languoids.find(l => l.glottocode === code);
if (!languoid) {
  // Don't drop - preserve with null ID
  return {
    id: null,
    name: originalInput,
    glottocode: code,
    isValid: false
  };
}
```

**2. Validation** (mark cell invalid):
```typescript
const hasInvalid = value.some(item => item.id === null);
if (hasInvalid) {
  setValidationState('invalid');
}
```

**3. Visualization** (red styling):
```typescript
<Chip
  label={item.name}
  sx={{
    border: item.isValid ? '1px solid' : '2px solid',
    borderColor: item.isValid ? 'divider' : 'error.main',
    backgroundColor: item.isValid ? 'inherit' : 'error.light',
    color: item.isValid ? 'inherit' : 'error.dark',
  }}
  onDelete={handleDelete}
/>
```

**4. Block Commit** (if invalid remains):
```typescript
const hasInvalidItems = selectedItems.some(item => item.id === null);
if (hasInvalidItems) {
  // Don't commit - user must fix
  return;
}
```

**5. Change Detection** (removal of invalid is a change):
```typescript
const originalInvalidCount = originalValue.filter(v => v.id === null).length;
const currentInvalidCount = currentValue.filter(v => v.id === null).length;

if (originalInvalidCount !== currentInvalidCount) {
  // Removing invalid items counts as a change
  hasChanges = true;
}
```

### Applies To
- Multiselect FK fields (Languages)
- Through-model editors (Collaborators with roles)
- Any field with FK lookups that might fail

---

## Import/Export Patterns

### Human-Readable Format

**Principle**: Export format must be editable in Excel, import must accept same format

**Examples**:

**Choice Fields**:
```
Export: "3 - Access protected by a time limit"
Import: Accepts both "3 - Access..." and "3"
```

**MultiSelect**:
```
Export: "Audio, Video, Text"
Import: Parse comma-separated, map labels to values
```

**Booleans**:
```
Export: "Yes" / "No" / "Not specified"
Import: Accept "Yes", "yes", "TRUE", "true", etc.
```

**FK Relationships**:
```
Export: "English (stan1293)"
Import: Lookup by glottocode first, fallback to name
```

**Through-Models**:
```
Export: "John Doe (Author, Speaker; in citation)"
Import: Parse name, lookup collaborator, parse roles, parse citation flag
```

### Import Parser Pattern

**Structure**:
```typescript
export const parseFieldName = (
  value: string | null,
  lookupData: LookupDataType
): ParseResult => {
  if (!value || value.trim() === '') {
    return { value: null, text: '', error: null };
  }
  
  // Parse value
  const parsed = parseLogic(value);
  
  // Lookup in database
  const found = lookupData.find(item => matches(item, parsed));
  
  if (!found) {
    // PRESERVE invalid data
    return {
      value: { id: null, ...parsed, isValid: false },
      text: value,
      error: 'Not found in database'
    };
  }
  
  return {
    value: { ...found, isValid: true },
    text: formatForDisplay(found),
    error: null
  };
};
```

**Key Principles**:
- Return `{ value, text, error }` tuple
- Preserve invalid data with `id: null`
- Support multiple input formats (flexible)
- Case-insensitive matching

### Export Task Pattern

**File**: `app/metadata/tasks.py`

**Template**:
```python
@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_item_export_task(self, export_id: str, ids: list, user_id: int):
    try:
        logger.info(f"[EXPORT] Starting for {len(ids)} items")
        
        # Query with prefetch_related
        queryset = Item.objects.filter(id__in=ids)
        queryset = queryset.prefetch_related('language', 'title_item__language', ...)
        queryset = queryset.order_by(Lower('catalog_number'))
        
        # Build workbook
        wb = openpyxl.Workbook()
        ws = wb.active
        
        # Write headers
        headers = ['Catalog Number', 'Description', ...]
        for col_num, header in enumerate(headers, start=1):
            ws.cell(row=1, column=col_num, value=header)
        
        # Write data rows
        for row_num, item in enumerate(queryset, start=2):
            ws.cell(row=row_num, column=1, value=item.catalog_number)
            # Use display values for choice fields
            ws.cell(row=row_num, column=5, value=item.get_resource_type_display())
            ...
        
        # Atomic write (temp file to rename)
        temp_filename = f"{export_id}.tmp"
        temp_path = os.path.join(export_dir, temp_filename)
        final_path = os.path.join(export_dir, f"{export_id}.xlsx")
        
        wb.save(temp_path)
        
        # Validate file size
        file_size = os.path.getsize(temp_path)
        if file_size < 500_000:  # 500KB minimum
            raise ValueError(f"File too small: {file_size} bytes")
        
        os.rename(temp_path, final_path)
        
        logger.info(f"[EXPORT] Completed: {file_size} bytes")
        return {'status': 'success', 'file_path': final_path}
        
    except Exception as e:
        logger.error(f"[EXPORT] Failed: {e}")
        # Clean up partial files
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return {'status': 'error', 'error': str(e)}
```

**Key Elements**:
- `@shared_task(bind=True, max_retries=3, default_retry_delay=30)`
- `prefetch_related` to avoid N+1 queries
- `order_by(Lower('field'))` for case-insensitive sort
- Atomic write (temp file + validate + rename)
- Return error dict (not `raise self.retry()`)

---

## Performance Patterns

### Prefetch Related

**Always use** for M2M and reverse FK in list/export queries:

```python
queryset = queryset.prefetch_related(
    'language',                     # M2M
    'title_item__language',        # Reverse FK + nested FK
    'item_collaboratorroles__collaborator',  # Reverse FK + nested FK
)
```

**Impact**: 4,400 items export: Minutes without - Seconds with

### Case-Insensitive Sorting

**Use** `Lower()` for text field sorting:

```python
from django.db.models.functions import Lower

queryset = queryset.order_by(Lower('catalog_number'))
```

**Why**: Default Django sort is case-sensitive ("Zebra" before "apple")

### Debounced Search

**Pattern**: Debounce filter input to reduce API calls

```typescript
import { debounce } from 'lodash';

const debouncedApplyFilters = useMemo(
  () => debounce((newFilters) => {
    setActiveFilters(newFilters);
  }, 500),
  []
);

useEffect(() => {
  return () => debouncedApplyFilters.cancel();
}, [debouncedApplyFilters]);
```

**Apply To**: Filter inputs on list pages (not batch editor cell search)

---

## Validation Patterns

### Backend Validation

**For regular fields**: Standard DRF serializer validation

**For virtual fields**: Skip backend validation, validate in parser

**Skip List** (add to `skipValidationFields`):
- SerializerMethodField fields (primary_title, secondary_title)
- Through-model fields with attributes (collaborators with roles)
- Any field where backend can't validate structure

### Frontend Validation

**Unique Field Validation** (e.g., catalog_number):
```typescript
const validateCatalogNumber = async (value: string, currentRowId: string) => {
  // Check against cached items
  const existsInCache = cachedItems.some(
    item => item.catalog_number === value && item.id !== currentRowId
  );
  
  // Check against other draft rows
  const existsInDrafts = rows.some(
    row => row.id !== currentRowId && row.catalog_number === value
  );
  
  if (existsInCache || existsInDrafts) {
    return 'invalid'; // Duplicate found
  }
  
  return 'valid';
};
```

### Parser Validation

**For complex fields**, validate in parser:

```typescript
export const parseComplexField = (
  value: string,
  lookupData: LookupType
): ParseResult => {
  // Validation logic here
  if (!isValid) {
    return {
      value: { id: null, ...parsed, isValid: false },
      text: value,
      error: 'Validation error message'
    };
  }
  
  return { value: validData, text: displayText, error: null };
};
```

---

## Anti-Patterns (Don't Do This)

**Implementing without Redis caching** (>1000 rows)  
Will hit sessionStorage quota, painful retrofit

**Using timestamp for export_id** in backend  
Collision risk, timezone issues

**Filtering paginated state** for exports  
Only processes 25 rows instead of filtered dataset

**Silently dropping invalid data** on import  
User loses work, confused why data disappeared

**Not updating sessionStorage config** after save  
New rows disappear on browser refresh

**Using `raise self.retry()` in Celery tasks**  
Can cause silent failures, corrupted files

**Forgetting prefetch_related** for M2M  
N+1 query problem, slow exports

**Case-sensitive sorting** for text fields  
"Zebra" before "apple" confuses users

---

## Quick Reference

**Starting new batch editor?**
1. Copy ItemBatchEditor.tsx as template
2. Implement Redis caching from start
3. Implement async export (UUID + timestamp)
4. Check if custom editors needed (through-models? virtual fields?)
5. Follow 6 universal patterns checklist
6. Test with 10 rows to 100 rows to full dataset

**List page button order convention**: Export button comes BEFORE Batch Edit button. This is established on all list pages (Collaborator, Item) and must be followed for consistency.

**Debugging batch operations?**
1. Check Redis cache: `redis-cli -p 6387 GET item_list_full`
2. Add logging: Filter counts, IDs being sent
3. Compare frontend filter with backend FilterBackend
4. Verify TypeScript interface matches serializer field names
5. Check Celery logs for task execution

---

**See also**:
- `docs/system-behavior/batch-editor/validation.md` - Validation flow diagrams (canonical)
- `../03-LESSONS/item-batch-editor.md` - Comprehensive patterns & checklist
- `../01-ARCHITECTURE/system-overview.md` - Cache & Celery architecture
- `frontend.md` - React patterns
- `backend.md` - Django patterns
