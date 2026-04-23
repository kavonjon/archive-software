# Collaborator Batch Editor Lessons

**Status**: Complete, Production  
**Scale**: 7,400 collaborators × 35 fields  
**Date**: 2025-11-10 to 2025-11-13

**Note**: Item batch editor (2025-11-17) is now the state-of-the-art reference. This file preserved for historical context and specific Collaborator patterns.

---

## Overview

**Second batch editor** implemented (after Languoid, before Item)

**Established**:
- 6 universal patterns (now documented in batch-editor-universal-patterns)
- Through-model pattern (later refined in Item)
- Comprehensive lessons captured for future implementations

**Superseded By**: Item batch editor for most patterns (more complete, refined)

---

## Collaborator-Specific Patterns

### `scrollToRowId` Pattern

**Purpose**: After a batch save, scroll to the first affected row so the user can see the result.

**Implementation**:
```typescript
// Batch editor receives scrollToRowId prop from list page
interface Props {
  scrollToRowId?: number;
}

// On mount or data load, if scrollToRowId is set, scroll to it
useEffect(() => {
  if (scrollToRowId && rows.length > 0) {
    const rowIndex = rows.findIndex(r => r.id === scrollToRowId);
    if (rowIndex >= 0) {
      virtualizer.scrollToIndex(rowIndex, { align: 'center' });
    }
  }
}, [rows, scrollToRowId]);
```

**Pass from list page**: When navigating to batch editor after a specific action, include the first-affected row ID so the user lands on the relevant data.

### Name Field Architecture
- Component fields: first_names, nickname, last_names, name_suffix
- Computed: full_name (via signal)
- Format: `first_names "nickname" last_names name_suffix`

**Batch Editor**:
- Edit component fields (editable)
- Display full_name (read-only, auto-updates)

**Implementation**:
```typescript
// In column config
{ 
  key: 'full_name', 
  label: 'Full Name', 
  cellType: 'text',
  editable: false  // Read-only
},
{ 
  key: 'first_names', 
  label: 'First and Middle Name(s)', 
  cellType: 'text',
  editable: true 
},
```

**Signal** (backend):
```python
@receiver(pre_save, sender=Collaborator)
def compute_collaborator_derived_fields(sender, instance, **kwargs):
    parts = [
        instance.first_names,
        f'"{instance.nickname}"' if instance.nickname else None,
        instance.last_names,
        instance.name_suffix
    ]
    instance.full_name = ' '.join(filter(None, parts)).strip()
```

### Native/Other Languages

**M2M relationships** with auto-add parent dialect pattern

**Implementation**: Standard multiselect cell type

**Signal enforcement**:
```python
@receiver(m2m_changed, sender=Collaborator.native_languages.through)
def auto_add_parent_language_for_collaborator_dialects(...):
    # Check ALL current languoids
    all_languoids = instance.native_languages.all()
    
    # Find dialects missing parent
    parents_to_add = []
    for languoid in all_languoids:
        if languoid.level_glottolog == 'dialect' and languoid.parent_languoid:
            if not all_languoids.filter(id=languoid.parent_languoid.id).exists():
                parents_to_add.append(languoid.parent_languoid)
    
    # Add missing parents
    if parents_to_add:
        instance.native_languages.add(*parents_to_add)
```

**Reusable For**: Any M2M with hierarchy rules

### Skip Validation for SerializerMethodField

**Problem**: `native_languages` and `other_languages` are SerializerMethodField (read-only), backend can't validate

**Solution**: Skip backend validation, validate in parser

```typescript
const skipValidationFields = [
  'native_languages',  // SerializerMethodField
  'other_languages',   // SerializerMethodField
];
```

**Import Parser** handles validation:
```typescript
const languoid = languoids.find(l => l.glottocode === code || l.name === name);
if (!languoid) {
  return {
    id: null,  // Invalid but preserved
    name: originalInput,
    glottocode: code,
    isValid: false
  };
}
```

---

## Universal Patterns Established

**During this implementation**, discovered 6 universal patterns:
1. Session persistence (sessionIds ref)
2. Order-preserving refresh
3. Three batch edit modes (selected/filtered/empty)
4. Warning dialogs (filtered mode only)
5. Cell editor pagination (page_size=200)
6. Import value comparison (robust, no false positives)

**See**: `../02-PATTERNS/batch-editors.md` for full documentation

---

## Import/Export Patterns

### Boolean Field Comparison

**Problem**: `false || ''` - `''` (loses boolean value)

**Solution**: Use `??` instead of `||`

```typescript
// WRONG
value: collaborator.anonymous || ''

// CORRECT
value: collaborator.anonymous ?? ''
```

### Field Type Map Completeness

**Problem**: Missing fields in fieldTypeMap - `undefined` in comparison - false positives

**Solution**: ALL editable fields must be in map

```typescript
const fieldTypeMap: FieldTypeMap = {
  collaborator_id: 'number',
  first_names: 'text',
  // ... EVERY field, don't skip any
  anonymous: 'boolean',
  gender: 'select',
};
```

---

## Debugging Lessons

### False Positive Changes

**Symptom**: Unchanged fields marked yellow (changed) after import

**Causes**:
1. Using `||` instead of `??` for defaults
2. Missing fields in fieldTypeMap
3. Not comparing booleans before string conversion
4. Case-sensitive text comparison

**Debug**:
```typescript
console.log({
  original: cell.original,
  current: cell.value,
  equal: areCellValuesEqual(cell.original, cell.value)
});
```

### New Row Disappearance

**Symptom**: Save new row - refresh - row gone

**Cause**: sessionIds not persisting new IDs

**Fix**: Add to sessionIds after save

---

## CellEditor Keyboard / Blur Handling

### Blur Suppression and Escape Propagation

A specific interaction issue discovered during Collaborator implementation (collab_batch_025):

**Problem**: CellEditor blur fires when user opens a dropdown or autocomplete inside the editor, causing the editor to close prematurely.

**Solution**: Suppress blur events that originate from within the editor container (click-outside detection):

```typescript
const handleBlur = (e: React.FocusEvent) => {
  // Check if focus is leaving to an element OUTSIDE the editor
  if (!editorRef.current?.contains(e.relatedTarget as Node)) {
    // Genuine blur (focus went outside) - close editor
    handleCancel();
  }
  // If focus stayed inside (e.g., clicked dropdown option) - do nothing
};
```

**Escape key must propagate**: When Escape is pressed inside a nested dropdown (e.g., Autocomplete), it should first close the dropdown, then on the second Escape, close the editor. Handle by checking if the dropdown is still open before propagating cancel.

---

## `organizeLanguoidChips` Pattern

When displaying an array of languoid (language/dialect) chips in the frontend, use the `organizeLanguoidChips` function to group and order them correctly (families, then languages, then dialects under their parents).

**`actualIndex` fix**: When filtering/mapping over a chip array, use the original array index (`actualIndex`) rather than the filtered-list index to correctly reference and remove items. Using the filtered index causes incorrect chips to be deleted.

```typescript
// WRONG - index is position in filtered array
filteredLanguoids.map((lang, index) => (
  <Chip onDelete={() => removeItem(index)} />
));

// CORRECT - use original array index
languoids.map((lang, actualIndex) => 
  matchesFilter(lang) && (
    <Chip onDelete={() => removeItem(actualIndex)} />
  )
);
```

---

## Key Files

**Implementation**:
- `frontend/src/components/collaborators/CollaboratorBatchEditor.tsx`
- `frontend/src/services/collaboratorImportTransformer.ts`
- `frontend/src/services/collaboratorImportValueParsers.ts`

**Backend**:
- `app/internal_api/serializers.py` (InternalCollaboratorSerializer, InternalCollaboratorBatchSerializer)
- `app/internal_api/views.py` (InternalCollaboratorViewSet)
- `app/metadata/tasks.py` (generate_collaborator_export_task)

---

## Lessons Applied to Item

All patterns from Collaborator were applied to Item implementation:
- Session persistence (complete)
- Order-preserving refresh (complete)
- Three modes (complete)
- Warning dialogs (complete)
- Cell pagination (complete)
- Robust comparison (complete)

**Plus new patterns**:
- Invalid data preservation (new in Item)
- Complex through-models (refined in Item)
- Virtual field handling (new in Item)

---

**See**: `item-batch-editor.md` for state-of-the-art patterns and comprehensive Document implementation guide
