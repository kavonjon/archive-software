# Form and picker patterns (reference)

**Context note (2026-05-24):** Detail-page in-place editing, controlled inputs, catalog validation, and FK picker dropdowns. **Primary code:** `EditableField` / `EditableTextField` on detail pages, picker serializers in `internal_api/serializers.py`.

**See also:** General React patterns in `02-PATTERNS/frontend.md`. Batch editor cell editors in `02-PATTERNS/batch-editors.md`.

---

## Controlled components

**Always** for inputs in React:

```typescript
const [value, setValue] = useState('');

<TextField
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**Never**: Uncontrolled with refs (except for file inputs)

---

## In-place editing

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

---

## Catalog number validation (in-place edit)

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

## Picker dropdowns (client-side search)

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

**Do not confuse with:** Languoid list `page_size=10000` load-all — picker loads minimal fields for dropdown search only. See `list-page-patterns.md` for list-page exceptions.
