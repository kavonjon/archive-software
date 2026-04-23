# Stage 1: Batch Editing

**Status**: 3 of 4 complete, Document next  
**Strategic Value**: Immediate efficiency gains for museum staff workflows

---

## Implementation Status

| Model | Rows | Fields | Status | Reference |
|-------|------|--------|--------|-----------|
| Languoid | 1,200 | 40 | Production | Foundation |
| Collaborator | 7,400 | 35 | Production | Universal patterns established |
| Item | 4,400 | 61 | Production | **STATE-OF-THE-ART** |
| Document | TBD | TBD | Next | Final in Stage 1 |

---

## Architecture Overview

### Smart Spreadsheet Interface

**Design Philosophy**: Looks and behaves exactly like Excel/Google Sheets

**Core Features**:
- In-browser editing (no Excel required)
- Virtualized rendering (60 FPS with 10,000+ rows)
- Live validation with visual feedback
- Import/export XLSX (round-trip compatible)
- Undo/redo (50 action history)
- Change tracking (yellow cells = edited)
- Conflict detection (optimistic locking)

### Technology Stack

**Frontend**:
- TanStack Table v8 (virtualization)
- TanStack Virtual (row rendering)
- Redux Toolkit (state management with undo/redo)
- Custom cell editors (Material-UI overlays)

**Backend**:
- Redis caching (mandatory for >1000 rows)
- Celery async exports (>100 rows)
- DRF serializers (Full + Batch per model)
- Atomic saves with optimistic locking

---

## 6 Universal Patterns (Mandatory)

All batch editors MUST implement:

1. **Session Persistence** - sessionIds ref tracks rows across refreshes
2. **Order-Preserving Refresh** - Rows stay in user's order, don't resort
3. **Three Modes** - selected/filtered/empty with standard config
4. **Warning Dialogs** - Only for filtered mode without active filters
5. **Cell Editor Pagination** - page_size=200 for dropdowns
6. **Import Comparison** - Robust comparison (no false positives)

**See**: `../02-PATTERNS/batch-editors.md` for details

---

## Component Architecture

### Reusable Core

**TanStackSpreadsheet.tsx**:
- Virtualized grid rendering
- Keyboard navigation (Arrow keys, Enter, Tab)
- Selection management (checkbox + click)
- Copy/paste with clipboard API
- Cell editing orchestration

**CellEditor.tsx**:
- Modal editor for all standard cell types
- Text, select, multiselect, boolean, relationship, stringarray
- Server-side validation integration
- Invalid data visualization

**Redux State** (batchSpreadsheetSlice):
- Rows, columns, loading, saving, error
- Undo/redo stacks (50 action limit)
- Actions: updateCell, addRow, deleteRow, initializeSpreadsheet

### Model-Specific Wrappers

**Pattern**: Configure reusable core with model-specific logic

**Example** (ItemBatchEditor.tsx):
```typescript
const COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'catalog_number', label: 'Catalog Number', cellType: 'text', width: 150 },
  { key: 'resource_type', label: 'Resource Type', cellType: 'select', width: 200, 
    metadata: { options: RESOURCE_TYPE_OPTIONS } },
  { key: 'language', label: 'Languages', cellType: 'multiselect', width: 200,
    metadata: { endpoint: '/languoids/' } },
  { key: 'collaborators', label: 'Collaborators', cellType: 'collaborator_roles', width: 250,
    metadata: { roleChoices: ROLE_CHOICES } },
  // ... 61 fields total
];

// Transform model to row
const itemToRow = (item: Item): SpreadsheetRow => { ... };

// Validation
const handleCellChange = (rowId, key, newValue, newText) => {
  if (key === 'catalog_number') {
    // Check uniqueness
  }
  // Standard cell update
};

// Save
const handleSaveAllConfirm = async () => {
  // Transform rows to model data
  // Call API
  // Handle response
};
```

**Code Reuse**: ~95% core, ~5% model-specific

---

## Custom Cell Editors

### When Needed

- Through-models with attributes (CollaboratorRole)
- Text + FK composites (ItemTitle)
- Complex validation (unique constraints)

### Pattern: Through-Model Editor

**Example**: CollaboratorRolesCellEditor (Item <-> Collaborator)

**Features**:
- Search/add items (Autocomplete)
- Display as cards
- Edit attributes per card (multiselect roles + boolean citation)
- Invalid items as red cards (id: null)
- Block commit if invalid remain

**Adaptation**:
1. Update value interface
2. Replace API endpoint
3. Replace attribute editors
4. Update display formatting

### Pattern: Text + FK Editor

**Example**: TitleWithLanguageCellEditor

**Features**:
- TextField for text input
- Autocomplete for FK selection
- Keyboard handling (Enter/Escape with autocomplete awareness)
- Change detection (both text and FK)

**Adaptation**:
1. Rename fields in interface
2. Replace FK options source
3. Update labels/placeholders
4. Update display formatting

---

## Import/Export

### Human-Readable Format

**Principle**: Export must be editable in Excel, import accepts same format

**Examples**:
- Choice: `"3 - Access protected by a time limit"` (not `"3"`)
- MultiSelect: `"Audio, Video, Text"` (not `"audio,video,text"`)
- Boolean: `"Yes"` / `"No"` / `"Not specified"` (not `true/false/null`)
- FK: `"English (stan1293)"` (not `"15"`)
- Through-model: `"John Doe (Author, Speaker; in citation)"` (not JSON)

### Import Architecture

**Three-file pattern**:
1. **ColumnMapper** - Maps spreadsheet columns to model fields
2. **ValueParsers** - Parse complex fields (collaborators with roles, titles with language)
3. **Transformer** - Orchestrates parsing, builds spreadsheet rows

**Hook**: `useImportItemSpreadsheet.ts` - Integration with batch editor

### Export Architecture

**Two paths**:
- **Sync** (≤100 rows): Immediate response with file
- **Async** (>100 rows): UUID task ID, frontend polls, timestamp filename

**Celery Task** pattern:
- UUID for uniqueness
- Atomic write (temp file + validate + rename)
- File size validation (min 500KB)
- Return error dict (not raise retry)
- Use prefetch_related (avoid N+1)
- Use Lower() for sorting

---

## Invalid Data Preservation

**New pattern** discovered in Item implementation

**Problem**: User imports "Engliswwh" (typo) - Silently dropped - Confused

**Solution**: Preserve, visualize, allow correction

**Implementation**:
1. **Parser**: Return `{ id: null, name: input, isValid: false }`
2. **Validation**: Mark cell invalid if any id: null items
3. **Visualization**: Red chips/cards for invalid
4. **Block commit**: Can't save if invalid remain
5. **Change detection**: Removal of invalid counts as change

**User Workflow**:
1. Import with typo - Cell red
2. Open editor - See red chip
3. Delete red chip - Cell yellow
4. Save successfully

---

## Performance Validated

| Metric | Result |
|--------|--------|
| Cache build | 15-20 seconds (one-time) |
| Cache hit | <1 second |
| Save batch | <2 seconds |
| Async export | ~18 seconds (4,400 rows) |
| Scroll FPS | 60 FPS (4,400 rows) |

**Key Optimizations**:
- Row virtualization (only render visible ~30 rows)
- Redis caching (avoid repeated serialization)
- prefetch_related (avoid N+1)
- Debounced validation (reduce API calls)

---

## Document Batch Editor Checklist

### Pre-Implementation Reading
- [ ] This file (item-batch-editor.md) - comprehensive
- [ ] `../02-PATTERNS/batch-editors.md` - 6 universal patterns
- [ ] `ItemBatchEditor.tsx` - reference code
- [ ] Custom editors (CollaboratorRoles, TitleWithLanguage)

### Model Analysis
- [ ] List all Document fields (count?)
- [ ] Identify complex fields (through-models? virtual?)
- [ ] Identify choice fields (verify constants in api.ts)
- [ ] Check unique fields (like catalog_number)
- [ ] Estimate cache size (rows x fields x avg size)

### Phase 1: Backend (2-3 hours)
- [ ] InternalDocumentSerializer (all fields + display values)
- [ ] InternalDocumentBatchSerializer (minimal + filter fields)
- [ ] InternalDocumentViewSet (batch=true conditional)
- [ ] Redis caching in list() (202 pattern)
- [ ] warm_document_list_cache task
- [ ] generate_document_export_task (UUID + atomic write)

### Phase 2: Frontend Basic (3-4 hours)
- [ ] DocumentBatchEditor.tsx (copy Item as template)
- [ ] DocumentCacheContext.tsx (copy pattern)
- [ ] Update DocumentsList.tsx (buttons)
- [ ] Define COLUMN_CONFIG (cellTypes)
- [ ] Import choice constants
- [ ] Implement itemToRow
- [ ] Implement handleCellChange
- [ ] Implement handleSaveAllConfirm

### Phase 3: Complex Fields (1-2 hours)
- [ ] Identify reusable custom editors
- [ ] Adapt/create custom editors
- [ ] Add cellType cases to CellEditor.tsx
- [ ] Add clipboard cases to TanStackSpreadsheet.tsx
- [ ] Implement invalid preservation (id: null)
- [ ] Red visualization for invalid

### Phase 4: Import/Export (2-3 hours)
- [ ] documentImportColumnMapper.ts
- [ ] documentImportTransformer.ts
- [ ] documentImportValueParsers.ts (adapt Item parsers)
- [ ] useImportDocumentSpreadsheet.ts
- [ ] skipValidationFields (virtual fields)
- [ ] Test export - import round-trip
- [ ] Test invalid data import

### Phase 5: Testing (1-2 hours)
- [ ] Test 10 rows (all field types)
- [ ] Test 100 rows (async export triggers)
- [ ] Test full dataset (cache performance)
- [ ] Test new row + browser refresh
- [ ] Test validation (unique fields)
- [ ] Test invalid data workflow
- [ ] Verify 6 universal patterns
- [ ] Compare with Item (any gaps?)

**Estimated Total**: 9-14 hours (with all patterns established)

---

## Anti-Patterns (Don't Do This)

No Redis caching (retrofit is painful)  
Timestamp export_id backend (use UUID)  
Filter paginated state (use full cache)  
Drop invalid data (preserve with id: null)  
Skip validation for real fields (fix bugs)  
Don't update sessionStorage after save (rows disappear)  
Use raise self.retry() (use return error dict)  
Hardcode choices (import from api.ts)  
Case-sensitive sort (use Lower())  
Forget prefetch_related (N+1 queries)  

---

## Key Files

**Reference Implementation**:
- `frontend/src/components/items/ItemBatchEditor.tsx`

**Custom Editors**:
- `frontend/src/components/batch/CollaboratorRolesCellEditor.tsx`
- `frontend/src/components/batch/TitleWithLanguageCellEditor.tsx`
- `frontend/src/components/batch/CellEditor.tsx`

**Import Logic**:
- `frontend/src/services/itemImportColumnMapper.ts`
- `frontend/src/services/itemImportTransformer.ts`
- `frontend/src/services/itemImportValueParsers.ts`
- `frontend/src/hooks/useImportItemSpreadsheet.ts`

**Backend**:
- `app/internal_api/serializers.py` (lines 1-200 for Item serializers)
- `app/internal_api/views.py` (InternalItemViewSet)
- `app/metadata/tasks.py` (generate_item_export_task)

---

**Ready for Document implementation** - all patterns established, components reusable, comprehensive guide complete.
