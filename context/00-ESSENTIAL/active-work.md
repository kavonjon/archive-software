# Active Work

**Last Updated**: 2026-04-23

## Current Priority

**Document Batch Editor** - Final batch editor in Stage 1

Status: Ready to begin  
Reference: Item batch editor (state-of-the-art, 61 fields)  
Expected: Simpler than Item (likely fewer complex fields)

## Production Status

**System Deployment**: **LIVE in production on private server with real data**

**Critical Constraint**: All changes MUST be backward compatible. No breaking changes allowed.

**Deployment Platform**: TrueNAS Scale 25 via custom App (docker-compose.private.yml)

**Update Scripts**:
- `deploy-update-private.sh` - Code deployment without data disruption
- `deploy-restore-db-private.sh` - Database restore with safety backups

**Database Backups**:
- Automated: Daily at 3:00 AM via Celery Beat to `backup/dumps/`
- Retention: 30 days daily, 6 months weekly, 2 years monthly

## MVP vs Beyond MVP

### MVP (Critical for Launch)

**High Priority**:
- [ ] Documents to Files model migration (production data migration required)
- [ ] Full file content storage and ingestion system (move from metadata-only to actual repository)
- [ ] Automated sync processes (private to public file and metadata synchronization)
- [ ] Virus scanning implementation (multi-stage quarantine, infrastructure ready but commented out)
- [ ] Database synchronization (event-driven, checksum-based incremental sync)

**Medium Priority**:
- [ ] Internal vs public API classification system (documentation control)

### Beyond MVP (Future Enhancements)

**Archivist-Controlled Temporary Sharing**:
- [ ] Archivist interface for selective temporary file sharing
- [ ] Select specific files to make temporarily accessible on public server
- Note: temp_storage volume and automated cleanup infrastructure MUST exist in MVP even though push mechanism is beyond MVP

## Recent Achievements (Last 30 Days)

### Item Batch Editor (Complete - Production Ready)
- 61 fields, 4,400 rows, ~17MB cached
- Custom editors: CollaboratorRolesCellEditor, TitleWithLanguageCellEditor
- Invalid data preservation pattern (id: null to red visualization)
- Redis caching with async rebuild
- Async export with UUID backend, timestamp frontend
- Comprehensive import/export with human-readable format

### Item List Page Improvements
- Filter persistence across navigation (matches Collaborator/Languoid)
- Fixed batch edit filtered & export filtered (697 vs 685 discrepancy)
- UI consistency: Title + count display pattern
- Field name corrections: description_scope_and_content, collaborators.name
- InternalItemBatchSerializer: Added titles field for complete filtering

### Bug Fixes
- Backend validate_field type fix (DecimalField validation receives deserialized value)
- Navigation menu reordered (Collections before Items)
- Catalog number uniqueness validation in batch editor

## Development Stage

**Stage 1: Batch Editing** (3 of 4 complete)
- Complete: Languoid batch editor
- Complete: Collaborator batch editor
- Complete: Item batch editor - **CURRENT REFERENCE**
- Next: Document batch editor - **NEXT**

**After Stage 1**: Move to Stage 2 (Repository Management)

## Next Steps

### Document Batch Editor Implementation
1. Analyze Document model fields and relationships
2. Identify complex fields needing custom editors
3. Plan serializers (InternalDocumentSerializer, InternalDocumentBatchSerializer)
4. Implement Redis caching from start
5. Reuse custom editors where patterns match (CollaboratorRoles? Titles?)
6. Follow Item batch editor checklist in `../03-LESSONS/item-batch-editor.md`

### Pre-Implementation Reading
- `../03-LESSONS/item-batch-editor.md` - Complete patterns and checklist
- `../02-PATTERNS/batch-editors.md` - 6 universal patterns
- `frontend/src/components/items/ItemBatchEditor.tsx` - Reference code
- `app/internal_api/serializers.py` - InternalItemBatchSerializer pattern

## Known Issues

None currently blocking.

## Important Context

### Batch Editor Pattern Evolution
- **Languoid** (first) - Established foundation
- **Collaborator** (second) - Added through-model patterns, lessons documented
- **Item** (third) - Most complex, new patterns (invalid preservation, virtual fields)
- **Document** (fourth) - Should be fastest with all patterns established

### Key Learnings
- Redis caching is mandatory for >1000 rows (not optional)
- Client-side filtering requires complete data in batch serializer
- Invalid data should be preserved and visualized, not dropped
- Virtual fields need parser validation, skip backend validation
- UUID + timestamp hybrid works best for export IDs

### Performance Baselines
- Cache build: 15-20 seconds (one-time)
- Cache hit: <1 second
- Save batch: <2 seconds
- Async export: ~18 seconds for 4,400 rows

## Tech Debt (Not Blocking)

- Item batch editor: Two validation paths (import uses backend, live-edit uses local)
- Celery: Hard restarts sometimes needed on macOS (pkill -9)
- Some legacy Django template code still references old models (stub classes prevent crashes)
- Duplicate languoid endpoints: Both internal API and public API expose languoid data — paths may overlap causing confusion
- Temporary permissions on migrate view: A `kavon` user has temporary permissions on a data migration view — needs cleanup before wider deployment
- `django-video-encoding` library: Needs replacement (Stage 4 backlog)
- Multi-file upload UI: Needs update for Django 5 FileInput changes (Stage 4 backlog)
- Virus scanning sequencing: Architecture defined, currently commented out in deployment
- SERVER_ROLE conditional code: Mode flags incomplete in some areas

## Files Recently Modified

**Backend:**
- `app/internal_api/views.py` - validate_field DecimalField fix
- `app/internal_api/serializers.py` - Item titles field added
- `app/metadata/tasks.py` - Export task improvements (now cleaned up)
- `app/metadata/signals.py` - Item browse_categories, collection auto-assignment

**Frontend:**
- `frontend/src/components/items/ItemsList.tsx` - Filter persistence, UI consistency
- `frontend/src/components/items/ItemBatchEditor.tsx` - Complete implementation
- `frontend/src/components/batch/CollaboratorRolesCellEditor.tsx` - Through-model editor
- `frontend/src/components/batch/TitleWithLanguageCellEditor.tsx` - Text+FK editor
- `frontend/src/components/Navigation.tsx` - Menu reordering
- `frontend/src/services/api.ts` - Item interface updates
- `frontend/src/contexts/ItemCacheContext.tsx` - Cache management

## Development Tips

**Starting work on Document batch editor:**
1. Copy ItemBatchEditor.tsx as starting template (don't start from scratch)
2. Analyze Document model in Django to understand field complexity
3. Check if CollaboratorRolesCellEditor or TitleWithLanguageCellEditor patterns apply
4. Plan serializers early - batch serializer must include all filter fields
5. Implement Redis caching in first iteration (don't retrofit)

**Debugging batch operations:**
1. Check Redis cache status: `redis-cli GET item_list_full`
2. Check Celery logs in terminal running dev.sh
3. Add console.log for filter counts, IDs being sent
4. Compare frontend filter logic with backend FilterBackend
5. Verify TypeScript interface matches serializer field names

**Testing changes:**
1. Check linter: Use ReadLints tool on edited files
2. Check browser console for errors/warnings
3. Test on small dataset first (10 rows)
4. Test async operations (cache rebuild, exports)
5. Test invalid data handling (import with typos)

---

## Project context index

**File index:** `00-ESSENTIAL/context-map.md`. **Historical snapshots and debt/genealogy material:** `05-ARCHIVE/`.

**Status**: Ready for Document batch editor implementation
