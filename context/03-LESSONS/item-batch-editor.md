# Item Batch Editor Lessons

**Status**: State-of-the-art reference implementation (Complete, Production)  
**Scale**: 4,400 items × 60 fields (~17MB cached) — was 61 fields until `permission_to_publish_online` removed (2026-05-24)  
**Date**: 2025-11-17 (Initial) | 2026-03-14 (validate_field fix) | 2026-05-24 (permission field removed)

**Purpose**: Comprehensive guide for Document batch editor implementation. All patterns, anti-patterns, and lessons learned captured here.

**Validation flows:** Canonical diagrams and per-editor comparison — `docs/system-behavior/batch-editor/validation.md` (not duplicated in this file). Read before changing Item `handleCellChange`, `validateField`, or import skip lists.

---

## Executive Summary

**Achievements**:
- Most complex batch editor to date (60 fields as of 2026-05-24; 61 at initial completion)
- New patterns: Invalid data preservation, virtual field handling, complex through-models
- Reusable components: CollaboratorRolesCellEditor, TitleWithLanguageCellEditor
- Performance validated: 4,400 rows, <1s cached load, ~18s async export

**For Document Implementation**:
- Copy ItemBatchEditor.tsx as template
- Reuse custom editors where patterns match
- Implement Redis caching from start (don't retrofit)
- Follow 5-phase checklist (see below)

---

## Pattern Fidelity Lessons

### 1. Redis Caching is Mandatory (Not Optional)

**What Happened**: Initially implemented without Redis - hit sessionStorage quota (15.32MB)

**Lesson**: Any model with >1000 rows or >5MB cache MUST have Redis caching from start

**Correct Pattern**:
- Backend: Check cache in `list()`, return 202 if stale, trigger Celery rebuild
- Frontend: ItemCacheContext with polling for 202 responses
- Don't retrofit - implement in first iteration

### 2. UUID Backend, Timestamp Frontend

**What Happened**: Used timestamps for export_id - collision risk, timezone issues

**Lesson**: Separate concerns - backend needs uniqueness, frontend needs readability

**Correct Pattern**:
- Backend: `export_id = str(uuid.uuid4())`
- Frontend: Generate filename with timestamp on download
- Format: `items_export_2026-03-14_143022.xlsx`

### 3. Client-Side Filtering Uses Full Cache

**What Happened**: Filtered operations used paginated state - only 25 rows processed

**Lesson**: Always use full cached dataset for exports and batch edits

**Correct Pattern**:
```typescript
// WRONG
const filtered = items.filter(item => matches(item)); // Only 25 rows

// CORRECT
const allCached = await getItems();
const filtered = allCached.filter(item => matches(item)); // All 4,400 rows
const ids = filtered.map(i => i.id);
```

### 4. Async Export Error Handling

**What Happened**: Used `raise self.retry()` - silent failures, corrupted 2KB files

**Lesson**: Return error dict pattern is clearer and more reliable

**Correct Pattern**:
```python
@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_item_export_task(self, export_id, ids, user_id):
    try:
        # Export logic
        return {'status': 'success', 'file_path': path}
    except Exception as e:
        logger.error(f"Export failed: {e}")
        return {'status': 'error', 'error': str(e)}
        # NOT: raise self.retry(exc=e)
```

### 5. Virtual Fields Skip Backend Validation

**What Happened**: Import validation failed for `primary_title` (SerializerMethodField) with 405 errors

**Lesson**: Backend can't validate virtual fields - validate in parser instead

**Correct Pattern**:
```typescript
// In useImportItemSpreadsheet.ts
const skipValidationFields = [
  'primary_title',    // SerializerMethodField
  'secondary_title',  // SerializerMethodField
  'collaborators',    // Through-model with attributes
];
```

### 6. New Rows Must Update sessionStorage Config

**What Happened**: New rows disappeared on browser refresh (F5)

**Lesson**: sessionStorage config must be updated after successful save

**Correct Pattern**:
```typescript
// After successful save of draft rows
const newIds = savedResponses.map(r => r.id);
newIds.forEach(id => sessionIds.current.add(id));

// Update sessionStorage
const config = JSON.parse(sessionStorage.getItem('item-batch-config') || '{}');
config.ids = Array.from(sessionIds.current);
sessionStorage.setItem('item-batch-config', JSON.stringify(config));
```

---

## New Universal Patterns Discovered

### Pattern: Complex Through-Model with Attributes

**Example**: CollaboratorRole (FK + MultiSelectField roles + Boolean citation_author)

**Implementation**:

**Backend Serializer**:
```python
class InternalItemSerializer(serializers.ModelSerializer):
    collaborators = serializers.SerializerMethodField()
    
    def get_collaborators(self, obj):
        return [{
            'id': cr.collaborator.id,
            'name': cr.collaborator.full_name,
            'roles': cr.roles,
            'citation_author': cr.citation_author
        } for cr in obj.item_collaboratorroles.select_related('collaborator')]
    
    def update(self, instance, validated_data):
        collab_data = validated_data.pop('collaborators_data', None)
        
        if collab_data is not None:
            # Clear existing
            CollaboratorRole.objects.filter(item=instance).delete()
            
            # Create new
            for collab in collab_data:
                CollaboratorRole.objects.create(
                    item=instance,
                    collaborator_id=collab['id'],
                    roles=collab['roles'],
                    citation_author=collab['citation_author']
                )
        
        return super().update(instance, validated_data)
```

**Frontend Editor**: `CollaboratorRolesCellEditor.tsx`
- Search/add collaborators (Autocomplete)
- Display as cards with attribute editors per card
- Multiselect for roles, checkbox for citation
- Invalid items (id: null) shown as red cards
- Block commit if invalid remain

**Reusable For**: Any through-model with attributes (adapt component interface)

### Pattern: Text + FK Composite Field

**Example**: ItemTitle (title text + language FK)

**Implementation**:

**Backend Serializer**:
```python
primary_title = serializers.SerializerMethodField()

def get_primary_title(self, obj):
    title = obj.title_item.filter(default=True).first()
    if title:
        return {
            'title': title.title,
            'language': {
                'id': title.language.id,
                'name': title.language.name,
                'glottocode': title.language.glottocode
            } if title.language else None
        }
    return None

def update(self, instance, validated_data):
    primary_title_data = validated_data.pop('primary_title_data', None)
    
    if primary_title_data is not None:
        # Update or create default title
        ItemTitle.objects.update_or_create(
            item=instance,
            default=True,
            defaults={
                'title': primary_title_data['title'],
                'language_id': primary_title_data.get('language_id')
            }
        )
```

**Frontend Editor**: `TitleWithLanguageCellEditor.tsx`
- TextField for title text
- Autocomplete for language selection
- Keyboard handling (Enter/Escape with autocomplete awareness)

**Reusable For**: Any text + FK relationship pattern

### Pattern: Invalid Data Preservation

**Problem**: User imports "Engliswwh (typo)" - Old approach: silently dropped - User confused

**Solution**: Preserve with `id: null`, show red, allow correction

**Implementation**:

**1. Parser**:
```typescript
const languoid = languoids.find(l => l.glottocode === code);
if (!languoid) {
  return {
    id: null,
    name: originalInput,
    glottocode: code,
    isValid: false
  };
}
```

**2. Validation**:
```typescript
const hasInvalid = value.some(item => item.id === null);
if (hasInvalid) {
  cellValidationState = 'invalid';
}
```

**3. Visualization**:
```typescript
<Chip
  label={item.name}
  sx={{
    borderColor: item.isValid ? 'divider' : 'error.main',
    backgroundColor: item.isValid ? 'inherit' : 'error.light',
    color: item.isValid ? 'inherit' : 'error.dark',
  }}
/>
```

**4. Block Commit**:
```typescript
if (selectedItems.some(item => item.id === null)) {
  // Don't commit - user must fix
  return;
}
```

**User Workflow**:
1. Import with typo - Cell red - Tooltip shows error
2. Open editor - See red chip with original input
3. Delete red chip - Cell turns yellow (changed)
4. Save successfully

---

## Performance Patterns Validated

### Redis Caching
- **Build**: 15-20 seconds (one-time)
- **Hit**: <1 second
- **TTL**: 1 hour (auto-refresh on save)
- **Mandatory**: For >1000 rows

### Async Export
- **Threshold**: >100 rows
- **Time**: ~18 seconds for 4,400 rows
- **User feedback**: Polling with progress dialog

### Prefetch Related
- **Critical**: Always prefetch M2M and reverse FK
- **Example**: `prefetch_related('language', 'title_item__language', 'item_collaboratorroles__collaborator')`
- **Impact**: Minutes to seconds for exports

### Case-Insensitive Sorting
- **Use**: `order_by(Lower('catalog_number'))`
- **Why**: "Zebra" before "apple" is confusing

---

## Debugging Strategies

### Celery Silent Failures

**Symptom**: Task marked complete, no execution logs, corrupted file

**Cause**: Task crashes before first line (decorator issue, import error)

**Debug**:
```python
@shared_task(bind=True, max_retries=3)
def my_task(self, ...):
    logger.info("Task STARTED")  # Add BEFORE try block
    try:
        ...
```

**Check**:
- Decorator params match function signature
- All imports at top (not just in try)
- Syntax errors: `python3 -m py_compile tasks.py`

### Client-Side Filter Count Mismatch

**Symptom**: List page shows 697 items, batch editor loads 685

**Cause**: Batch serializer missing fields needed for filtering

**Debug**:
```typescript
// Log sample item structure
console.log('Sample:', items[0]);

// Log filter matches
console.log({
  catalogMatch,
  descMatch,
  titlesMatch,  // undefined? Field missing!
  collabMatch
});
```

**Fix**: Add missing field to batch serializer

**Example**: Added `titles` SerializerMethodField to InternalItemBatchSerializer

### Field Name Mismatches

**Symptom**: Filters don't work, comparisons fail, TypeScript errors

**Cause**: Frontend interface doesn't match backend serializer

**Debug**:
1. Check TypeScript interface in `api.ts`
2. Check actual API response in Network tab
3. Grep for all usages: `rg 'item\.description'`

**Fix**: Update interface to match serializer exactly
- Backend: `description_scope_and_content`
- Frontend: Must use same name (not `description`)

---

## Item-Specific Patterns

### Dynamic Export Columns

**Problem**: Items can have unlimited additional titles, spreadsheet needs fixed columns

**Solution**: Analyze max titles, generate columns dynamically (cap at 10)

```python
max_additional_titles = max(
    item.title_item.filter(default=False).count() 
    for item in queryset
)
max_additional_titles = min(max_additional_titles, 10)

headers = ['Catalog Number', 'Primary Title', 'Secondary Title']
for i in range(max_additional_titles):
    headers.append(f'Additional Title {i+1}')
```

**Reusable**: Document unlikely to need this pattern

### Catalog Number Uniqueness

**Validation**: Check against cached items AND draft rows

```typescript
const isDuplicate = (value: string, currentRowId: string): boolean => {
  // Check cache
  const existsInCache = cachedItems.some(
    item => item.catalog_number === value && item.id !== currentRowId
  );
  
  // Check draft rows
  const existsInDrafts = rows.some(
    row => row.id !== currentRowId && row.catalog_number === value
  );
  
  return existsInCache || existsInDrafts;
};
```

**Reusable**: Document might have similar unique identifier

### Browse Categories Computation

**Auto-calculated** from genre, resource_type, language_description_type, public_event

**Not editable** in batch editor (read-only computed field)

**Reusable**: Document unlikely to have similar auto-categorization

---

## Reusable Components

### CollaboratorRolesCellEditor

**File**: `frontend/src/components/batch/CollaboratorRolesCellEditor.tsx`

**Use For**: Through-models with multiple attributes

**Interface**:
```typescript
interface Props {
  cell: { 
    value: Array<{
      id: number | null;
      name: string;
      roles: string[];
      citation_author: boolean;
      isValid?: boolean;
    }>; 
  };
  onCommit: (newValue: any, text: string) => void;
  onCancel: () => void;
  metadata: { roleChoices: ChoiceOption[] };
}
```

**Adaptation Guide**:
1. Update value interface (replace roles/citation_author with your attributes)
2. Update search API (replace collaboratorsAPI with your API)
3. Update attribute editors (replace multiselect + checkbox with your fields)
4. Update display format in handleCommit
5. Update metadata prop (pass your choice options)

### TitleWithLanguageCellEditor

**File**: `frontend/src/components/batch/TitleWithLanguageCellEditor.tsx`

**Use For**: Text + FK composite fields

**Interface**:
```typescript
interface Props {
  cell: { 
    value: {
      title: string;
      language: { id: number; name: string; glottocode: string } | null;
    } | null;
  };
  onCommit: (newValue: any, text: string) => void;
  onCancel: () => void;
  metadata: { languoidOptions: Languoid[] };
}
```

**Adaptation Guide**:
1. Rename `title` and `language` to your field names
2. Replace languoidOptions with your FK options
3. Update TextField label/placeholder
4. Update display format in handleCommit

### Enhanced Multiselect (CellEditor.tsx)

**Enhancements** for invalid item handling:
- Filter out `id: null` items on init
- Render invalid chips with red styling
- Cancel commit if invalid remain
- Detect removal of invalid as change

**Applies To**: All multiselect fields (Languages, Genre, etc.)

### Import Parsers

**File**: `frontend/src/services/itemImportValueParsers.ts`

**Reusable Templates**:

**parseCollaboratorsWithRoles**:
- Input: `"John Doe (Author, Speaker; in citation)"`
- Output: `{ id, name, roles[], citation_author, isValid }`
- Adapt for: Any multi-attribute through-model

**parseTitleWithLanguage**:
- Input: `"My Title (English)"`
- Output: `{ title, language: {...} }`
- Adapt for: Any text + FK pattern

**parseCommaSeparatedLanguoids**:
- Input: `"Swahili (swah1253), English (stan1293)"` (or other formats)
- Output: `[{ id, name, glottocode }, ...]`
- Feature: **Preserves invalid** with `id: null`

---

## Filter Persistence & Client-Side Filtering

### Problem Discovered

**Symptom**: List page showed 697 items, batch editor/export loaded 685

**Root Cause**: Batch serializer missing `titles` field - frontend couldn't replicate backend filter

**Solution**: Added `titles` SerializerMethodField to InternalItemBatchSerializer

**Lesson**: Batch serializer must include ALL fields that backend filter checks

### Backend vs Frontend Filter Parity

**Backend keyword filter checks**:
- `catalog_number__icontains`
- `description_scope_and_content__icontains`
- `title_item__title__icontains` (JOIN)
- `collaborator__full_name__icontains` (JOIN)

**Frontend filter must check**:
- `item.catalog_number`
- `item.description_scope_and_content`
- `item.titles` array (ALL titles)
- `item.collaborators` array (name field)

**Implementation**:
```typescript
const applyFiltersToCache = (items: Item[], filters: FilterState): Item[] => {
  return items.filter(item => {
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
    return true;
  });
};
```

### Field Name Corrections

**Issue 1**: Frontend used `item.description` but backend returns `description_scope_and_content`

**Fix**: Update frontend to match backend field name exactly

**Issue 2**: Frontend checked `collab.collaborator_data.full_name` but batch serializer returns `collab.name`

**Fix**: Update to use `collab.name` (simpler structure in batch serializer)

**Lesson**: Always verify TypeScript interface matches serializer output exactly

---

## Validate Field Type Fix (2026-03-14)

### Problem

**Symptom**: Latitude/longitude cells red after import from numeric Excel columns

**Root Cause**: Backend `validate_field` endpoint called `field.run_validation(value)` but threw away result, then passed raw string to `validate_latitude(value)` which expects Decimal

**Type Error**: Python 3 can't compare string to number - TypeError - caught - returned as invalid

### Fix Applied

**File**: `app/internal_api/views.py`

**Change**:
```python
# BEFORE
field.run_validation(value)
...
validate_method(value)  # Raw string - TypeError!

# AFTER
validated_value = field.run_validation(value)
...
validate_method(validated_value)  # Deserialized Decimal - works!
```

**Why Correct**: DRF validators expect deserialized values (contract)

**Scope**: Benefits ALL fields with custom `validate_<field>` methods

**Don't Skip**: latitude/longitude are real fields with meaningful validation (not virtual) - fix bug, don't bypass

### Lesson 

**In validate_field endpoints**: Always pass deserialized value from `field.run_validation()` to custom validators

**Applies To**: Collaborator, Item, Document batch editor validate_field patterns

---

## Anti-Patterns Summary

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| Implementing without Redis | sessionStorage quota | Redis from start |
| Timestamp export_id backend | Collision risk | UUID backend, timestamp frontend |
| Filter paginated state | Only 25 rows | Full cache + client-side filter |
| Drop invalid data | User loses work | Preserve with id: null, show red |
| Skip validation for real fields | Accept invalid data | Fix validator bugs |
| Not update sessionStorage | New rows disappear | Update after save |
| Use raise self.retry() | Silent failures | Return error dict |
| Hardcode choice constants | Duplication | Import from api.ts |
| Case-sensitive sort | Bad UX | use Lower() |
| Forget prefetch_related | N+1 queries | Always prefetch |

---

## Document Batch Editor Checklist

### Pre-Implementation
- [ ] Read this file completely
- [ ] Read `docs/system-behavior/batch-editor/validation.md` (live/import/save flows)
- [ ] Read `../02-PATTERNS/batch-editors.md` (6 universal patterns)
- [ ] Review `ItemBatchEditor.tsx` (reference code)
- [ ] Review custom editors (CollaboratorRoles, TitleWithLanguage)
- [ ] Analyze Document model (field count, complex fields)

### Phase 1: Backend
- [ ] Create InternalDocumentSerializer (full, all fields)
- [ ] Create InternalDocumentBatchSerializer (minimal, all filter fields)
- [ ] Implement ViewSet with batch=true conditional
- [ ] Implement Redis caching in list() (202 pattern)
- [ ] Create warm_document_list_cache task
- [ ] Create generate_document_export_task (UUID + atomic write)
- [ ] Use prefetch_related for M2M
- [ ] Use Lower() for sorting

### Phase 2: Frontend Basic
- [ ] Create DocumentBatchEditor.tsx (copy Item as template)
- [ ] Create DocumentCacheContext.tsx (copy pattern)
- [ ] Update DocumentsList.tsx (batch edit + export buttons)
- [ ] Define column configs (cellTypes)
- [ ] Import choice constants from api.ts
- [ ] Implement itemToRow transformation
- [ ] Implement handleCellChange with validation
- [ ] Implement handleSaveAllConfirm

### Phase 3: Complex Fields
- [ ] Identify which custom editors to reuse
- [ ] Adapt or create custom editors for Document-specific fields
- [ ] Add cellType cases to CellEditor.tsx if needed
- [ ] Add clipboard serialization to TanStackSpreadsheet.tsx
- [ ] Implement invalid data preservation (id: null)
- [ ] Test commit/cancel logic

### Phase 4: Import/Export
- [ ] Create documentImportColumnMapper.ts
- [ ] Create documentImportTransformer.ts
- [ ] Create documentImportValueParsers.ts (adapt Item parsers)
- [ ] Create useImportDocumentSpreadsheet.ts hook
- [ ] Add skipValidationFields (virtual fields)
- [ ] Test round-trip (export - import)
- [ ] Test invalid data import and correction
- [ ] Implement async export (UUID backend, timestamp frontend)

### Phase 5: Testing
- [ ] Test 10 rows (verify all field types)
- [ ] Test 100 rows (verify async export triggers)
- [ ] Test 1000+ rows (verify Redis cache performance)
- [ ] Test new row creation + browser refresh persistence
- [ ] Test validation (unique fields if any)
- [ ] Test invalid data workflow
- [ ] Test 6 universal patterns
- [ ] Compare with Item batch editor (any patterns missed?)

---

## Success Metrics

**Implementation**:
- 61 fields handled successfully
- 2 custom editors created (highly reusable)
- 4,400 rows perform well
- All 6 universal patterns implemented

**Performance**:
- Cache load: <1s (cached), 15-20s (cold)
- Save batch: <2s
- Export: <3s sync (≤100 rows), ~18s async (4,400 rows)

**Code Quality**:
- 0 TypeScript errors
- 0 linter errors
- High pattern fidelity
- Comprehensive documentation

**Readiness**: High confidence for Document implementation

---

## Key Files

**Reference Implementation**:
- `frontend/src/components/items/ItemBatchEditor.tsx`

**Custom Editors**:
- `frontend/src/components/batch/CollaboratorRolesCellEditor.tsx`
- `frontend/src/components/batch/TitleWithLanguageCellEditor.tsx`
- `frontend/src/components/batch/CellEditor.tsx` (multiselect enhancements)

**Import Logic**:
- `frontend/src/services/itemImportColumnMapper.ts`
- `frontend/src/services/itemImportTransformer.ts`
- `frontend/src/services/itemImportValueParsers.ts`
- `frontend/src/hooks/useImportItemSpreadsheet.ts`

**Backend**:
- `app/internal_api/serializers.py` (InternalItemSerializer, InternalItemBatchSerializer)
- `app/internal_api/views.py` (InternalItemViewSet)
- `app/metadata/tasks.py` (generate_item_export_task)

---

**Next**: Implement Document batch editor using this as comprehensive guide
