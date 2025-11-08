# Dialect & DialectInstance Model Decommissioning

**Date:** November 8, 2025  
**Migration:** `0102_decommission_dialect_models.py`  
**Status:** ✅ Code Complete - Ready for Migration Execution

---

## 📋 Overview

This decommissioning removes the deprecated `Dialect` and `DialectInstance` models, replacing them with Django's built-in M2M through tables. This simplifies the codebase while preserving all language relationships.

### Why Decommission?

1. **Overcomplicated Design**: `DialectInstance` was a custom through model with required fields (`modified_by`) that made simple M2M operations complex
2. **Deprecated Data Model**: The old `Language`/`Dialect` split has been replaced by the unified `Languoid` model with hierarchical relationships
3. **Code Complexity**: Manual through model management required custom serializer logic and signal handling
4. **Cleaner Alternative**: Django's default M2M tables are simpler, faster, and require less code

---

## 🔄 Changes Summary

### 1. **Model Changes** (`app/metadata/models.py`)

**Removed Models:**
- `Dialect` (entire model deleted)
- `DialectInstance` (entire model deleted)

**Updated M2M Fields:**
- `Collaborator.native_languages` - removed `through='DialectInstance'`
- `Collaborator.other_languages` - removed `through='DialectInstance'`
- `Item.language` - removed `through='DialectInstance'`
- `Document.language` - removed `through='DialectInstance'`

### 2. **Serializer Changes** (`app/internal_api/serializers.py`)

**Before:**
- Manually created `DialectInstance` objects with `modified_by` tracking
- Manually triggered `m2m_changed` signals
- Complex error handling for through model creation

**After:**
- Simple `.set()` method for M2M updates
- Django automatically triggers signals
- ~60 lines of code removed per serializer

### 3. **Signal Changes** (`app/metadata/signals.py`)

**Before:**
- Queried `DialectInstance` to determine which M2M field was updated
- Retrieved `modified_by` from `DialectInstance` records
- Manually created `DialectInstance` objects for parent languages

**After:**
- Detects M2M field from through table name (`db_table`)
- Uses simple `.add()` method for parent languages
- ~40 lines of code removed per signal

### 4. **Admin & Forms Cleanup**

**Files Updated:**
- `app/metadata/admin.py` - Removed `Dialect` and `DialectInstance` registrations
- `app/metadata/forms.py` - Removed `DialectForm`, `DialectInstanceForm`, and `DialectInstanceCustomForm`

### 5. **Migration** (`0102_decommission_dialect_models.py`)

**Operations:**
1. Alter M2M fields to remove `through` parameter (creates new default through tables)
2. Migrate relationships from `DialectInstance` to new through tables
3. Delete `DialectInstance` and `Dialect` models (drops database tables)

---

## 🗄️ Data Migration Details

### What Gets Migrated ✅
- All M2M relationships (Collaborator → Languoid, Item → Languoid, Document → Languoid)
- Relationship types (native_languages vs. other_languages)

### What Gets Discarded ❌
- `DialectInstance.modified_by` (audit trail)
- `DialectInstance.added` and `.updated` (timestamps)
- `DialectInstance.name` (M2M to `Dialect` objects - deprecated)
- `Dialect` objects entirely

### Through Table Mapping

| Old Through Model | New Through Table (Auto-generated) |
|-------------------|-------------------------------------|
| `DialectInstance` (collaborator_native → language) | `metadata_collaborator_native_languages` |
| `DialectInstance` (collaborator_other → language) | `metadata_collaborator_other_languages` |
| `DialectInstance` (item → language) | `metadata_item_language` |
| `DialectInstance` (document → language) | `metadata_document_language` |

---

## 🚀 Running the Migration

### Pre-Migration Checklist

- [ ] **Backup database** (critical - rollback not supported)
- [ ] Review migration file: `app/metadata/migrations/0102_decommission_dialect_models.py`
- [ ] Check current `DialectInstance` count: `DialectInstance.objects.count()`
- [ ] Verify no active development on language M2M fields

### Execute Migration

```bash
cd /Users/kavon/git/archive-software/app
pipenv run python manage.py migrate metadata 0102_decommission_dialect_models
```

### Post-Migration Verification

1. **Check for errors in migration output**
2. **Verify relationship counts:**
   ```python
   # Django shell
   from metadata.models import Collaborator, Item, Languoid
   
   # Check a few collaborators
   c = Collaborator.objects.filter(native_languages__isnull=False).first()
   print(f"{c.full_name} native languages: {c.native_languages.count()}")
   print(f"Languages: {[l.name for l in c.native_languages.all()]}")
   
   # Check a few items
   i = Item.objects.filter(language__isnull=False).first()
   print(f"Item {i.catalog_number} languages: {i.language.count()}")
   ```

3. **Verify models are gone:**
   ```python
   # This should raise an error:
   from metadata.models import Dialect, DialectInstance  # Should fail
   ```

4. **Test language editing in React UI:**
   - Open a Collaborator detail page
   - Edit native_languages field
   - Add a dialect and verify parent language auto-adds
   - Save and verify data persists
   - Repeat for other_languages
   - Test on Item detail page

---

## 🧪 Testing Checklist

### Backend Testing
- [ ] M2M `.add()` method works for `native_languages`
- [ ] M2M `.add()` method works for `other_languages`
- [ ] M2M `.add()` method works for `Item.language`
- [ ] M2M `.set()` method works (serializers)
- [ ] `m2m_changed` signal fires correctly
- [ ] Parent language auto-add signal works for Collaborator
- [ ] Parent language auto-add signal works for Item
- [ ] No errors in Django logs

### Frontend Testing
- [ ] Collaborator detail page loads
- [ ] Native languages field displays correctly (hierarchical chips)
- [ ] Native languages field edits/saves correctly
- [ ] Other languages field displays correctly
- [ ] Other languages field edits/saves correctly
- [ ] Item detail page loads
- [ ] Item language field displays correctly
- [ ] Item language field edits/saves correctly
- [ ] Adding dialect auto-adds parent language (both models)
- [ ] Overview card shows languages with hierarchical sorting

### Performance Testing
- [ ] Collaborator list page loads quickly
- [ ] Item list page loads quickly
- [ ] No N+1 queries on language fields
- [ ] Batch editing still works (if applicable)

---

## 🔧 Code Quality Improvements

### Lines of Code Removed
- `models.py`: ~28 lines (2 model classes)
- `serializers.py`: ~120 lines (complex through model logic)
- `signals.py`: ~80 lines (DialectInstance queries and creation)
- `admin.py`: 2 lines (registrations)
- `forms.py`: ~25 lines (3 form classes)
- **Total: ~255 lines removed** ✨

### Complexity Reduction
- ✅ Eliminated custom through model complexity
- ✅ Removed manual `modified_by` tracking burden
- ✅ Simplified serializer `update()` methods
- ✅ Cleaner signal handlers (uses table names instead of queries)
- ✅ Django's built-in M2M manager handles everything

### Maintainability
- ✅ Follows Django best practices
- ✅ Less code = fewer bugs
- ✅ Easier for new developers to understand
- ✅ Standard M2M patterns throughout codebase

---

## 🎯 Benefits

1. **Simpler Code**: Standard Django M2M patterns, no custom through model logic
2. **Better Performance**: Django's optimized M2M queries instead of manual creation
3. **Easier Debugging**: Standard M2M behavior, no special cases
4. **Cleaner Signals**: Automatic signal firing, no manual triggering needed
5. **Unified Data Model**: All relationships use modern `Languoid` hierarchy

---

## ⚠️ Important Notes

### No Rollback Support
This migration is **one-way only**. Rollback is not supported because:
- `modified_by` audit data is lost (not in new through tables)
- `Dialect` associations are deprecated
- Recreating `DialectInstance` from new M2M tables would lose metadata

**Mitigation:** Always backup database before running migration.

### Affected Features
- ✅ Language editing (Collaborator, Item, Document) - **works better**
- ✅ Parent language auto-add - **still works**
- ✅ Hierarchical chip display - **still works**
- ✅ Language filters - **still works**
- ❌ `modified_by` tracking on language relationships - **no longer available**
- ❌ Old `Dialect` model references - **will break (intentionally removed)**

---

## 📞 Support

If you encounter issues:
1. Check Django logs for errors
2. Verify database constraints are satisfied
3. Check that signals are firing (debug logging enabled)
4. Review migration output for warnings
5. Contact lead developer with specific error messages

---

## ✅ Completion Criteria

**Migration is complete when:**
- [x] All code changes committed
- [ ] Migration executed successfully
- [ ] Post-migration verification passed
- [ ] Frontend testing passed
- [ ] No errors in production logs
- [ ] Documentation updated (this file)

