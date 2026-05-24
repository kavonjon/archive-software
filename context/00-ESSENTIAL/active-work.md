# Active Work

**Last Updated**: 2026-05-22

## Current Priority

**Document Batch Editor** - Final batch editor in Stage 1

Status: Ready to begin  
Reference: Item batch editor (state-of-the-art, 60 fields)  
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

### Item Access Level Chip Colors (2026-05-22)

**User-facing:** Access level chips on item pages are color-coded by level for quick visual scanning.

**Shared utility:** `frontend/src/utils/accessLevelChip.ts` — `getAccessLevelChipProps(accessLevel)` returns MUI Chip `color` and/or custom `sx`.

| Level | Color |
|---|---|
| 1 — Open Access | Green (`success`) |
| 2 — Onsite viewing | Blue (`info`) |
| 3 — Time-limited | Orange (`warning`) |
| 4 — Depositor-controlled | Yellow (custom `#fdd835`, dark text) |

**Applied in:** `ItemDetail.tsx` (header status chips), `ItemsList.tsx` (mobile card chips), `itemListColumnHelpers.tsx` (`AccessLevelCell` for desktop table column).

**Not changed:** Batch editor access level column (editable select, not status chips); filter dropdowns (no chip display).

### Remove Permission to Publish Online Field (2026-05-24)

**Decision:** Field removed entirely — no longer needed in cataloging workflows.

**Backend:**
- Dropped `Item.permission_to_publish_online` and `Columns_export.item_permission_to_publish_online`
- Migration `0105_remove_permission_to_publish_online.py` (applied)
- Removed from `InternalItemSerializer`, item export headers/rows (`internal_api/views.py`, `metadata/tasks.py`), legacy Django views/forms/templates, CSV import

**Frontend:**
- Removed from `ItemDetail`, `ItemCreate`, `ItemBatchEditor`, `api.ts` Item interface, import mapper/transformer

**Migration pitfall (fixed):** `RemoveField` for ColumnsExport must use model name `columns_export` (not `columnsexport`) — wrong name breaks `makemigrations` with `KeyError`.

**Migration 0106 (applied):** `0106_alter_item_browse_categories` — Django metadata sync only (choice order + `nac` label `"NAC"` → `"Native American Church"`); no data recalculation.

### Context System — frontend.md Split (2026-05-24)

**Why:** `02-PATTERNS/frontend.md` exceeded ~500-line monitoring threshold (~1,097 lines).

**Phase 1:** List page patterns → `04-REFERENCE/frontend/list-page-patterns.md`

**Phase 2:** Form, React conventions, app shell → `04-REFERENCE/frontend/form-patterns.md`, `react-conventions.md`, `app-shell-patterns.md`

**Result:** `frontend.md` trimmed to ~350 lines (core patterns + stubs); index triad updated (`context-map.md`, `where-patterns-live.md`, `system-inventory.md`).

### Items List — Configurable Columns (2026-05-24)

**User-facing:** Items list desktop table supports show/hide columns via hamburger menu above the table (right of results count). Preferences persist across sessions.

**Architecture (list-specific — not batch editor patterns):**
- `usePersistedColumnVisibility` — `localStorage` key `item-list-visible-columns` (version **2**); separate from `usePersistedListState` / `item-list-state` (sessionStorage filters/selection/pagination)
- `ColumnVisibilityMenu` — Popover with grouped checkboxes; sticky header bar ("Columns" + "Reset to default" text button); scrollable body; reset applies without closing menu
- `itemListColumns.tsx` — column defs, groups, field order constants (`ITEM_LIST_COLUMN_GROUPS`, `ITEM_LIST_DETAIL_FIELD_ORDER`)
- `itemListColumnHelpers.tsx` — shared cell renderers (`CatalogCell`, `TitlesCell`, `CollaboratorsCell`, `PlainTextCell`, `truncatedChipSx`, etc.)

**Default visible columns:** Catalog # (locked), Call Number, Title(s), Resource Type, Languages, Access Level. Collaborators removed from defaults (still optional).

**Column inventory (~60 hideable + catalog):** All `InternalItemSerializer` list fields except helpers/excluded types. No new list API serializer required.

| Rule | Detail |
|---|---|
| Catalog # | Always visible (`hideable: false`) |
| Call Number | Separate column; not nested under Catalog # |
| Collection | Label "Collection"; displays `collection_abbr` (FK-derived) |
| Title(s) | All titles; default title gets "Primary" chip |
| Collaborators | Names + role labels (`ROLE_CHOICES`) in one column |
| Long text | Truncate ellipsis (`maxWidth: 240`); `title` tooltip |
| Access Level chip | Color via `getAccessLevelChipProps`; truncated via `truncatedChipSx` (long choice labels) |
| Table widths | Dynamic (`table-layout: auto`); no fixed widths on data columns |

**Picker groups:** Match `ItemDetail.tsx` card section names. Group order follows visual top-to-bottom reading on detail page (Titles → Collection Information → Item Details → … → Metadata History). Field order within each group from `ITEM_LIST_DETAIL_FIELD_ORDER` (detail card field order).

**Not in picker:** Files (detail card exists; no file fields on item list API yet). **Coordinates** group (lat/long) included — separate from Location card on detail.

**Explicitly excluded from columns:** `*_date_min`/`*_date_max`, raw choice codes (use `*_display`), slug/uuid/FK ids, deprecated file location fields, primary/english/indigenous title flat fields, migration/FileMaker/migrate/cataloged audit fields (except Last Updated + Modified By in Metadata History).

**UX decisions:**
- Column control above table (right of count), not in table header — avoids horizontal-scroll discoverability issues
- Hamburger (`Menu`) icon, not `ViewColumn`
- Do not reuse batch editor `ITEM_COLUMNS` config — different UX purpose; share only generic primitives (`ColumnVisibilityMenu`, persistence hook)

### Collections List Page — Filter Refactor (2026-05-23)

**CollectionFilter aligned to Item/Collaborator field-type patterns** (`app/internal_api/views.py` — internal list API only; not public API `CollectionFilter` or map `CollectionFilterBackend`):

| Field | Pattern | Params |
|---|---|---|
| Text fields | `*_contains` + `icontains` | abbr, name, extent, abstract, description, citation_authors |
| **genres** | MultiSelect token OR (Genre pattern) | `genres` — not `genres_contains` |
| **access_levels** | MultiSelect token OR + "Not specified" | `access_levels` — not `access_levels_contains`; plural aggregates item levels |
| **Date range** | Computed min/max DateFilters (Item creation-date pattern) | `date_range_min` (gte), `date_range_max` (lte) — not `date_range_contains` |
| Languages | M2M text search | `languages_contains` + `.distinct()` |
| Keywords | Cross-field OR | `keyword_contains` (includes display `date_range` text) |

**CollectionsList frontend** (`CollectionsList.tsx`):
- Genres + Access Levels: multi-select from `GENRE_CHOICES` / `ACCESS_LEVEL_CHOICES` with chips
- Date Range: separate From/To `type="date"` fields (same `Object.entries` block pattern as Items)
- `buildCollectionQueryParams` / `countCollectionFilters` handle `string[]` multi-selects
- `access_levels=,` encoding for "Not specified" (same as Item `access_level`)
- List UX parity: a11y, persisted selection, `CollectionExportButton` + client-side CSV export
- Persisted state key: `collection-list-state-v4` (bumped during filter refactor)

**Semantic note:** Collection `genres` and `access_levels` are plural MultiSelectFields aggregating associated items; filters are multi-select OR. Item `item_access_level` is singular — different model shape, different filter method.

### List Page Filters and Keyword Search (2026-05-22)

**Items list — new regular filters:**
- Language Description Type (multi-select; `language_description_type`; Genre-style regex token match on MultiSelectField)
- Collection (FK-only text search via `collection_contains`; abbr + name partial match)
- Original Format Medium (multi-select; `original_format_medium`; valid `FORMAT_CHOICES` only)

**Items list — filter cleanup:**
- Removed 7 empty-field toggles with no data (accession date, access level restrictions, indigenous/english title, legacy collection CharField, recording context, creation date)
- 9 empty-field toggles remain (aligned with Collaborator pattern)

**Backend filter parity:**
- `CollaboratorFilter`: added `keyword_contains` (cross-field OR search)
- `CollectionFilter`: completed — `keyword_contains` plus all advanced params the frontend already sent (`extent`, `abstract`, `date_range`, `access_levels`, `genres`, `languages`, `citation_authors`); M2M filters use `.distinct()`
- `InternalItemBatchSerializer`: FK-derived read-only `collection_name` / `collection_abbr` (not legacy `collection_name` CharField) for batch/cache filter parity

**Keyword search UX (Collections innovation rolled out):**
- Keywords always visible on Items, Collaborators, Languoids, Collections
- Advanced filters in collapsible panel; no explicit Search button
- Server-paginated lists: 500ms debounced auto-apply (`filters` vs `activeFilters`)
- Filter count chip counts advanced filters only (excludes keyword); Clear resets everything
- `initialLoadComplete`: full-page spinner only on first load; list stays visible during filter reloads
- Collections list aligned with Items/Collaborators (`usePersistedListState`, results count, seamless reload)

### Item Batch Editor (Complete - Production Ready)
- 60 fields, 4,400 rows, ~17MB cached
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

**Pre-existing gaps (not introduced this session):**
- Collaborator batch/cache filtering: empty-field (`*_isnull`) toggles not fully mirrored in `collaboratorMatchesActiveFilters` helper
- Collections list: no batch edit button (no Collection batch editor or backend batch API yet); export is client-side CSV only

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

## Decisions (2026-05-22)

### Item Collection Filter Uses FK Only (2026-05-22)

Collection filter on Items searches `Item.collection` FK (`collection__collection_abbr`, `collection__name`), not the legacy `Item.collection_name` CharField.

**Why?** FK is the authoritative link; legacy CharField is inconsistent (~65% of items lack FK — intentional data-quality signal when filter misses them).

**Alternatives considered:**
- Legacy CharField search: Rejected — duplicates/conflicts with FK data
- Search both CharField and FK: Rejected — would mask data-quality problems

**Trade-off accepted:** Items without Collection FK do not match collection filter until FK is assigned.

### List Page Filter UX Standard (2026-05-22)

Always-visible keyword search + collapsible advanced filters; debounced auto-apply on server-paginated lists; Languoids keep instant client-side keyword filter (load-all strategy unchanged).

**Why?** Collections page proved the UX; explicit Search button removed friction without sacrificing debounce on large datasets.

**Trade-off accepted:** Languoid list remains a special case (PM-approved load-all); do not copy to Items/Collaborators.

### CollectionFilter Refactor Scope (2026-05-23)

`CollectionFilter` in `internal_api/views.py` exists primarily for the React collections list page (+ `collection_abbr` exact for detail-page uniqueness validation). Safe to reshape holistically to match Item/Collaborator FilterSet patterns.

**Why refactor as a unit?** Original filter was ad hoc (`*_contains` + `icontains` on everything), which breaks MultiSelectField and computed date fields.

**Alternatives considered:**
- Frontend-only multi-select on `genres_contains`: Rejected — OR semantics impossible with single icontains param
- Reuse Item `filter_access_level` (`__in` on single CharField): Rejected — Collection `access_levels` is MultiSelectField

**Trade-off accepted:** Removed `genres_contains`, `access_levels_contains`, `date_range_contains` params; frontend/storage key bumped (`collection-list-state-v4`).

### Collection Date Range Filter Uses Computed Fields (2026-05-23)

List date filter uses `date_range_min` / `date_range_max` (aggregated from items via Celery task), not the display `date_range` CharField.

**Why?** Same pattern as Item creation dates: filter on computed min/max; display text remains for table/keyword search.

**Trade-off accepted:** Collections without computed dates (null min/max) won't match date filters until aggregation runs.

### Item List Column Preferences Use localStorage (2026-05-24)

Column visibility stored in `localStorage` (`item-list-visible-columns`), not `usePersistedListState` sessionStorage.

**Why?** Cross-session user preference (like batch-edit/export mode), not navigation-scoped list working state.

**Alternatives considered:**
- Extend `item-list-state` sessionStorage: Rejected — prefs lost when tab closes
- Backend user profile: Rejected — over-engineered for v1

**Trade-off accepted:** Column prefs are per-browser, not synced across devices.

### Item List Column Groups Mirror Item Detail Cards (2026-05-24)

Picker categories and within-group field order align with `ItemDetail.tsx` card layout — not batch editor sections or ad hoc groupings.

**Why?** Cross-page UX consistency for archivists who know detail-page card structure.

**Trade-off accepted:** Table column left-to-right order follows `ITEM_LIST_COLUMNS` array (defaults first), which may differ from picker group order when many columns visible.

### Item List Column Control Placement (2026-05-24)

Hamburger menu above table (flex row with results count), not in table header row.

**Why?** Wide tables scroll horizontally; header-end control was off-screen. Above-table placement is always visible on desktop (`!isMobile`).

**Alternatives considered:**
- Sticky header-end column: Rejected after testing — still easy to miss; duplicate with above-table cleaner

**Trade-off accepted:** Mobile card view unchanged (no column picker on xs/md card layout).

### Remove Item.permission_to_publish_online (2026-05-24)

Field removed from model, API, React UI, batch editor, and legacy Django import/export — not deprecated/inactive, fully deleted.

**Why?** No longer needed for cataloging or access-control workflows; `item_access_level` and `access_level_restrictions` remain the access fields.

**Alternatives considered:**
- Hide in UI only: Rejected — dead schema and API surface
- Migrate values elsewhere: Rejected — no replacement field

**Trade-off accepted:** Historical yes/no values dropped on migration; CSV imports with that column header are ignored.

### Item Access Level Chip Color Coding (2026-05-22)

Centralized in `getAccessLevelChipProps` (`utils/accessLevelChip.ts`) — single source for all item-page access level Chips.

**Why?** Level 1 was already green; extending color coding to levels 2–4 improves scan-ability for archivists reviewing access restrictions.

**Alternatives considered:**
- Inline ternary per component: Rejected — already duplicated in three places
- `primary` for level 2: Rejected — collides with resource type chip on `ItemDetail` header

**Trade-off accepted:** Level 4 uses custom yellow (`#fdd835`) because MUI Chip has no built-in yellow palette entry.

## Files Recently Modified

**Backend:**
- `app/metadata/models.py` - Removed `permission_to_publish_online`; removed `item_permission_to_publish_online` from Columns_export
- `app/metadata/migrations/0105_remove_permission_to_publish_online.py` - Field removal migration (new)
- `app/metadata/migrations/0106_alter_item_browse_categories.py` - browse_categories metadata sync (applied)
- `app/internal_api/serializers.py` - Removed permission field + display from InternalItemSerializer
- `app/internal_api/views.py` - CollectionFilter refactor; item export column removed
- `app/metadata/views.py` - Legacy search, column export, CSV import cleanup
- `app/metadata/forms.py`, `app/metadata/tasks.py` - Field removal
- `app/templates/item_detail.html`, `app/templates/columns_export_detail.html` - Legacy template cleanup

**Frontend:**
- `frontend/src/utils/accessLevelChip.ts` - Shared access level Chip color helper (new, 2026-05-22)
- `frontend/src/components/items/ItemDetail.tsx` - Access level chip colors; removed EditableBooleanField for permission
- `frontend/src/components/items/ItemsList.tsx` - Mobile card access level chip colors; column visibility wiring (2026-05-24)
- `frontend/src/components/items/itemListColumnHelpers.tsx` - `AccessLevelCell` uses helper; list cell renderers (2026-05-22/24)
- `frontend/src/components/items/ItemCreate.tsx` - Removed form control
- `frontend/src/components/items/ItemBatchEditor.tsx` - Removed column + boolean cell handling
- `frontend/src/services/api.ts`, `itemImportColumnMapper.ts`, `itemImportTransformer.ts` - Type/import cleanup

**Context (2026-05-24):**
- `02-PATTERNS/frontend.md` - Trimmed; stubs to `04-REFERENCE/frontend/*`
- `04-REFERENCE/frontend/list-page-patterns.md`, `form-patterns.md`, `react-conventions.md`, `app-shell-patterns.md` - New deep dives

**Backend (prior session):**
- `app/internal_api/views.py` - CollectionFilter refactor (genres, access_levels, date_range_min/max); Item/Collaborator filters from prior session
- `app/internal_api/serializers.py` - FK-derived collection fields on batch serializer; Item titles field
- `app/metadata/tasks.py` - Export task improvements (now cleaned up)
- `app/metadata/signals.py` - Item browse_categories, collection auto-assignment

**Frontend (prior session):**
- `frontend/src/hooks/usePersistedColumnVisibility.ts` - Column visibility localStorage hook (new, 2026-05-24)
- `frontend/src/components/list/ColumnVisibilityMenu.tsx` - Grouped column picker Popover (new, 2026-05-24)
- `frontend/src/components/items/itemListColumns.tsx` - Item list column defs + group order (new, 2026-05-24)
- `frontend/src/components/items/itemListColumnHelpers.tsx` - List cell renderers + truncation helpers (new, 2026-05-24)
- `frontend/src/components/items/ItemsList.tsx` - Column visibility wiring, default columns (2026-05-24); filters, keyword UX, cache filter parity
- `frontend/src/components/collections/CollectionsList.tsx` - Filter refactor, list UX parity, export (2026-05-23); server-paginated alignment (2026-05-22)
- `frontend/src/components/collections/CollectionExportButton.tsx` - Export filtered/selected (new)
- `frontend/src/utils/collectionExport.ts` - Client-side CSV export helper (new)
- `frontend/src/components/collaborators/CollaboratorsList.tsx` - Keyword search, `collaboratorMatchesActiveFilters` helper
- `frontend/src/components/languoids/LanguoidsList.tsx` - Always-visible keyword search
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
