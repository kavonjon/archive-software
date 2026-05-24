# Deprecated Patterns & Models

**Purpose**: Historical record of removed/obsolete patterns. Don't use these.

---

## Deprecated Models

### Dialect Model (Removed 2025-11-08)

**Was**: Separate model for dialect names

**Why Removed**: 
- Dialects now represented as Languoid objects with `level_glottolog='dialect'`
- Hierarchical parent-child relationship more flexible
- Eliminates duplicate data structures

**Migration**: `0102_decommission_dialect_models.py`

**Replaced By**: Languoid model with `parent_languoid` FK

**Code Cleanup**:
- Model definition removed from `app/metadata/models.py`
- Stub class preserved in `app/metadata/views.py` to prevent legacy view crashes
- Admin registration removed

---

### DialectInstance Model (Removed 2025-11-08)

**Was**: Custom through-model for M2M language relationships

**Structure**:
```python
class DialectInstance(models.Model):
    languoid = models.ForeignKey(Languoid)
    modified_by = models.ForeignKey(User, required=True)  # Problem!
    # Used for: Collaborator.native_languages, etc.
```

**Why Removed**:
- Required `modified_by` field made simple M2M operations complex
- Had to manually create objects and trigger signals
- Django's auto-generated M2M through tables are simpler and sufficient

**Relationships Migrated**:
- Collaborator.native_languages <-> Languoid
- Collaborator.other_languages <-> Languoid
- Item.language <-> Languoid
- Document.language <-> Languoid

**Replaced By**: Django auto-generated through tables (e.g., `metadata_collaborator_native_languages`)

**Metadata Lost**: modified_by tracking (intentionally discarded as not valuable)

**Code Cleanup**:
- Model definition removed
- Through table specs removed from related fields
- Stub class preserved to prevent legacy view crashes

---

### Item.permission_to_publish_online (Removed 2026-05-24)

**Was**: BooleanField(null=True) on Item — "Permission to publish online" (Yes/No/Not specified)

**Why Removed**: No longer needed in cataloging or access workflows; `item_access_level` and `access_level_restrictions` cover access control.

**Migration**: `0105_remove_permission_to_publish_online.py` (also removed `Columns_export.item_permission_to_publish_online` export toggle)

**Removed From**: Internal API serializer, React detail/create/batch editor, import mappers, legacy Django templates/views/import/export

**Note:** Migration model name must be `columns_export` (underscore), not `columnsexport`.

---

## Legacy / inactive code

### Invenio-related code

**Aligned with:** `01-ARCHITECTURE/product-requirements.md` (Legacy Invenio) and `05-ARCHIVE/technical-debt-history.md` (debt_001) for the same topic.

Invenio-related pieces remain in the repository but are **legacy/inactive**. Do **not** build new features on them. Removal may be blocked by dependencies or migration scope; treat as technical debt (`technical-debt-history.md`).

---

## Deprecated Libraries

### ReactGrid (Removed 2025-11-02)

**Was**: Initial spreadsheet library choice

**Why Removed**:
- No row virtualization - out-of-memory with 1,000+ rows
- Performance degraded significantly at scale
- Could not meet 10,000 row requirement

**Replaced By**: TanStack Table v8 with virtualization

**Migration**: Complete rewrite of spreadsheet components
- `TanStackSpreadsheet.tsx` replaced `SpreadsheetGrid.tsx`
- Redux state structure redesigned
- Cell rendering optimized with virtualization

**Lessons**:
- Always validate library performance at target scale before committing
- Virtualization is mandatory for 1,000+ row interfaces
- Headless libraries provide more control

---

## Deprecated Patterns

### Old Batch Edit Config Format (Deprecated 2025-11-13)

**Was**:
```typescript
sessionStorage.setItem('batch_edit_ids', JSON.stringify(ids));
```

**Why Deprecated**: No mode information (ambiguous whether selected or filtered)

**Replaced By**:
```typescript
const config = {
  mode: 'selected' | 'filtered' | 'empty',
  ids: number[],
  timestamp: number
};
sessionStorage.setItem('{model}-batch-config', JSON.stringify(config));
```

**Migration**: Update all list pages to use new config format

---

### Celery Task `raise self.retry()` Pattern (Discouraged)

**Was**:
```python
@shared_task(bind=True)
def my_task(self, ...):
    try:
        # work
    except Exception as e:
        raise self.retry(exc=e, countdown=30)
```

**Why Discouraged**: Can cause silent failures, corrupted files

**Preferred**:
```python
@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def my_task(self, ...):
    try:
        # work
        return {'status': 'success', ...}
    except Exception as e:
        logger.error(f"Failed: {e}")
        return {'status': 'error', 'error': str(e)}
```

**Rationale**: Clearer error handling, better logging, more predictable

---

### Field Validators for Transformations (Ineffective)

**Was**:
```python
def transform_value(value):
    return value.upper()

class MyModel(models.Model):
    field = models.CharField(validators=[transform_value])
```

**Why Ineffective**: Django ignores return value from validators (validation only, no transformation)

**Replaced By**: pre_save signals for transformations

```python
@receiver(pre_save, sender=MyModel)
def transform_field(sender, instance, **kwargs):
    if instance.field:
        instance.field = instance.field.upper()
```

---

### Save() Override for Derived Fields (Discouraged)

**Was**:
```python
class MyModel(models.Model):
    def save(self, *args, **kwargs):
        self.full_name = compute_full_name(self)
        super().save(*args, **kwargs)
```

**Why Discouraged**: 
- Can be bypassed by `bulk_update()`, `queryset.update()`
- Not called for bulk operations
- Less reliable than signals

**Preferred**: pre_save signals (always fire)

```python
@receiver(pre_save, sender=MyModel)
def compute_derived(sender, instance, **kwargs):
    instance.full_name = compute_full_name(instance)
```

---

### Timestamp-Based Export IDs (Deprecated 2025-11-17)

**Was**: `export_id = datetime.now().strftime('%Y%m%d_%H%M%S')`

**Why Deprecated**:
- Collision risk (concurrent exports)
- Timezone complexity
- Not truly unique

**Replaced By**: UUID backend, timestamp frontend filename

```python
# Backend
export_id = str(uuid.uuid4())

# Frontend download
const timestamp = formatDate(new Date(), 'YYYY-MM-DD_HHmmss');
const filename = `items_export_${timestamp}.xlsx`;
```

---

### Silently Dropping Invalid Import Data (Anti-Pattern)

**Was**: Parser returns `null` for invalid input - Data silently lost

**Why Bad**: User confused, loses work, can't correct typos

**Replaced By**: Invalid data preservation

```typescript
// OLD - drops data
if (!found) return null;

// NEW - preserves for correction
if (!found) {
  return {
    id: null,
    name: originalInput,
    isValid: false
  };
}
```

---

## Why Keep This File?

**Historical Context**: Understanding why decisions were made

**Avoid Regression**: Don't accidentally reintroduce deprecated patterns

**Learning**: Failed approaches inform better solutions

---

**See also**:
- `../01-ARCHITECTURE/data-models.md` - Current model structure
- `../02-PATTERNS/` - Current best practices
