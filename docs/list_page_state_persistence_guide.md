# List Page State Persistence Implementation Guide

## Overview

This guide documents how to add filter and selection state persistence to all list pages (Languoids, Collaborators, Items, Collections) so that state survives navigation within a browser session.

## Implementation Strategy

### 1. Use the `usePersistedListState` Hook

A reusable hook has been created at `frontend/src/hooks/usePersistedListState.ts` that handles all persistence logic using sessionStorage.

### 2. Pattern for Each List Page

#### Step 1: Import the Hook

```typescript
import { usePersistedListState } from '../../hooks/usePersistedListState';
```

#### Step 2: Define Default Filters

```typescript
const DEFAULT_FILTERS: FilterState = {
  field1_contains: '',
  field2_contains: '',
  // ... all filter fields
};
```

#### Step 3: Replace State Declarations

**Before:**
```typescript
const [filters, setFilters] = useState<FilterState>({...});
const [selectedCollaborators, setSelectedCollaborators] = useState<Collaborator[]>([]);
const [page, setPage] = useState(0);
const [rowsPerPage, setRowsPerPage] = useState(25);
```

**After:**
```typescript
const {
  filters,
  setFilters,
  selectedIds,
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  updateFilters,
  clearFilters,
  toggleSelection,
  setAllSelections,
  clearSelections,
} = usePersistedListState<FilterState, Collaborator>({
  storageKey: 'collaborator-list-state',  // Unique key per model
  defaultFilters: DEFAULT_FILTERS,
  defaultPagination: { page: 0, rowsPerPage: 25 },
});
```

#### Step 4: Update Selection Logic

**For individual toggle:**
```typescript
const handleCollaboratorSelect = (collaborator: Collaborator, checked: boolean) => {
  toggleSelection(collaborator.id, checked);
  
  // If parent component needs full objects:
  const selectedObjects = collaborators.filter(c => selectedIds.has(c.id));
  onSelectionChange?.(selectedObjects);
};
```

**For select all:**
```typescript
const handleSelectAll = (checked: boolean) => {
  setAllSelections(collaborators, checked);
  
  // If parent component needs full objects:
  const selectedObjects = checked ? collaborators : [];
  onSelectionChange?.(selectedObjects);
};
```

**Check if item is selected:**
```typescript
const isSelected = selectedIds.has(collaborator.id);
```

#### Step 5: Update Filter Logic

**Use helper methods:**
```typescript
// Update single filter
updateFilters({ field_name_contains: 'value' });

// Clear all filters
clearFilters();
```

**Or continue using setFilters directly** (hook will persist automatically):
```typescript
setFilters(prev => ({ ...prev, field_name_contains: 'value' }));
```

## Implementation Checklist by List Page

### ✅ Collaborators List (`CollaboratorsList.tsx`)

**Status:** Ready to implement
**Storage Key:** `'collaborator-list-state'`
**Filter Fields:**
- `first_names_contains`
- `last_names_contains`
- `full_name_contains`
- `collaborator_id_contains`
- `tribal_affiliations_contains`
- `native_languages_contains`
- `other_languages_contains`
- `anonymous` (boolean)
- `gender_contains`

**Special Considerations:**
- Has `activeFilters` state for debounced application
- Keep debounced filter application logic
- Update to persist `filters` and `selectedIds`
- Currently has `selectedCollaborators` array - convert to use `selectedIds` Set

**Changes Required:**
1. Add import for `usePersistedListState`
2. Define `DEFAULT_FILTERS` constant
3. Replace state declarations (lines 107-108, 131-145)
4. Update `handleCollaboratorSelect` to use `toggleSelection`
5. Update `handleSelectAll` to use `setAllSelections`
6. Update checkbox rendering to check `selectedIds.has(collaborator.id)`
7. Keep existing `activeFilters` logic for debounced API calls

---

### ✅ Languoids List (`LanguoidsList.tsx`)

**Status:** Partially implemented (selections only)
**Storage Key:** `'languoid-list-state'`
**Filter Fields:**
- `searchTerm` (string)
- `selectedLevelFilter` (string) - preset filter
- `levelFilter` (string) - advanced filter
- `familyFilter` (string)
- `regionFilter` (string)

**Current Implementation:**
- Already has selection persistence (lines 100-108)
- Uses `selectedIds` Set with sessionStorage
- Filters are NOT persisted

**Changes Required:**
1. Add import for `usePersistedListState`
2. Define filter state type:
```typescript
interface LanguoidFilterState {
  searchTerm: string;
  selectedLevelFilter: string;
  levelFilter: string;
  familyFilter: string;
  regionFilter: string;
}
```
3. Define `DEFAULT_FILTERS`
4. Replace individual filter state declarations (lines 88-93) with hook
5. Keep existing `selectedIds` logic (already using Set)
6. Update filter setters to use `updateFilters` or keep `setFilters`

---

### ✅ Items List (`ItemsList.tsx`)

**Status:** Ready to implement
**Storage Key:** `'item-list-state'`
**Filter Fields:**
- `catalog_number_contains`
- `access_level_contains`
- `call_number_contains`
- `accession_date_min`
- `accession_date_max`
- `indigenous_title_contains`
- `english_title_contains`
- `titles_contains`
- `resource_type_contains`
- `language_contains`
- `creation_date_min`
- `creation_date_max`
- `description_scope_and_content_contains`
- `genre_contains`
- `collaborator_contains`
- `depositor_name_contains`
- `keyword_contains`

**Current Implementation:**
- Uses `selectedItems` array
- Has `showFilters` toggle state
- Filter application requires explicit "Search" button click

**Changes Required:**
1. Add import for `usePersistedListState`
2. Define `DEFAULT_FILTERS` constant (lines 88-106)
3. Replace state declarations (lines 78, 82-83, 88-106)
4. Convert `selectedItems` array to use `selectedIds` Set
5. Update `handleItemSelection` to use `toggleSelection`
6. Update `handleSelectAll` to use `setAllSelections`
7. Update checkbox rendering to check `selectedIds.has(item.id)`
8. Keep existing filter application logic (button-triggered)

---

### ✅ Collections List (`CollectionsList.tsx`)

**Status:** Ready to implement
**Storage Key:** `'collection-list-state'`
**Filter Fields:**
- `collection_abbr_contains`
- `name_contains`
- `extent_contains`
- `abstract_contains`
- `description_contains`
- `date_range_contains`
- `access_levels_contains`
- `genres_contains`
- `languages_contains`
- `citation_authors_contains`
- `keyword_contains`

**Current Implementation:**
- Uses `selectedCollections` array
- Has `showFilters` toggle state
- Filters update state but no explicit "Search" button

**Changes Required:**
1. Add import for `usePersistedListState`
2. Define `DEFAULT_FILTERS` constant (lines 80-92)
3. Replace state declarations (lines 70, 74-75, 77, 80-92)
4. Convert `selectedCollections` array to use `selectedIds` Set
5. Update selection handlers to use `toggleSelection` and `setAllSelections`
6. Update checkbox rendering to check `selectedIds.has(collection.id)`

---

## Testing Checklist

For each list page, verify:

1. **Filter Persistence**
   - [ ] Apply filters, navigate away, return → filters still applied
   - [ ] Clear filters, navigate away, return → filters cleared
   - [ ] Change pagination, navigate away, return → pagination preserved

2. **Selection Persistence**
   - [ ] Select items, navigate away, return → items still selected
   - [ ] Deselect items, navigate away, return → deselection persisted
   - [ ] Select all, navigate away, return → all still selected

3. **Session Isolation**
   - [ ] Close tab → state cleared
   - [ ] Open new tab → fresh state
   - [ ] State does NOT persist across browser restarts

4. **Interaction with Batch Actions**
   - [ ] Batch edit with selected items → selections available
   - [ ] Export with filtered results → filters applied correctly

5. **Edge Cases**
   - [ ] Pagination beyond available pages handled gracefully
   - [ ] Invalid filter values handled
   - [ ] Storage quota exceeded handled gracefully

---

## Benefits

1. **User Experience:**
   - No need to re-apply filters after viewing details
   - Selections maintained during multi-step workflows
   - Pagination state preserved

2. **Workflow Efficiency:**
   - Batch operations: select items, view details, return to continue
   - Filtering: refine results, explore, return without re-filtering
   - Research: maintain context across navigation

3. **Technical:**
   - Centralized persistence logic in reusable hook
   - Consistent behavior across all list pages
   - sessionStorage prevents state pollution across tabs

---

## Implementation Priority

Suggested order:
1. **Collaborators** (most actively used, already has partial implementation)
2. **Languoids** (already has selection persistence, just add filters)
3. **Items** (high-value for research workflows)
4. **Collections** (completes the pattern across all models)

---

## Notes

- State persists only during browser session (sessionStorage)
- Each list page has unique storage key to prevent conflicts
- Hook handles serialization/deserialization automatically
- Compatible with existing filter and selection logic
- Does not interfere with batch edit or export functionality

