# Active Work

**Last Updated**: 2026-06-22 (Collection item collaborators rollup)

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

**PostgreSQL**: Pinned to `postgres:17` in all compose files (see Decisions). Do not use unpinned `postgres:latest`.

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

### Collection Detail — Item Collaborators Rollup (2026-06-22)

**Scope:** Read-only collaborator chips on collection detail overview card (above Languages / Genres). Staff request: list collaborators with roles at top of each collection.

**Not the same as Citation Authors:** Separate from staff-curated `citation_authors` M2M card. Rollup unions all `CollaboratorRole` rows on FK-linked items; shows name + roles only (no citation-author flag or styling).

**Backend:**
- `metadata/services/collection_item_collaborators.py` — `compute_item_collaborators_for_collection(collection)`:
  - Query `CollaboratorRole` where `item__collection=collection`
  - One entry per collaborator; union roles across items
  - Sort collaborators by last name (`order_collaborators_by_last_name` from citation_authors service)
  - **Collection-only** role label mapping: strip tokens, case-insensitive `ROLE_CHOICES` lookup, fallback to raw stored value for legacy data
- `InternalCollectionSerializer.item_collaborators` — read-only `SerializerMethodField`; `{ id, display_name, slug, roles, role_display }`
- **Not** stored on `Collection`, **not** in Celery aggregates, **not** on public API

**Frontend:**
- `CollectionDetail` overview card — "Collaborators" section; horizontal wrapping chips; label `Name (Role1, Role2)` via `formatCollaboratorRolesChipLabel`
- `frontend/src/utils/collaboratorRoleChip.ts` — shared chip label helper + multiline chip `sx` (also used by `EditableCollaboratorRolesField` on item detail for label formatting only)

**Tests:** `metadata/tests/test_collection_item_collaborators.py` (7 tests: FK scope, union, sort, non-citation inclusion, whitespace label mapping).

**Known limitation:** Legacy `CollaboratorRole.role` values not in `ROLE_CHOICES` (e.g. `authoreditor`, compound strings) still display as stored. Fixing that globally would touch exports, item detail API, batch editor — deferred.

---

### Collection `citation_authors` — M2M Field (2026-06-21)

**Scope:** `Collection.citation_authors` converted from free-text `TextField` to M2M → `Collaborator`. Old text data dropped (migration 0107).

**Model:** `ManyToManyField(Collaborator, related_name='collection_citation_authors', verbose_name='Citation Authors')`.

**Service:** `metadata/services/collection_citation_authors.py`:
- `compute_citation_authors_for_collection(collection)` — distinct collaborators with `citation_author=True` on FK-linked items, sorted by last name (anonymous last)
- `apply_citation_authors_to_collection(collection)` — replaces M2M; used by command only

**One-time command:** `python manage.py populate_collection_citation_authors [--abbrev ACH]`. Run once per environment post-deploy; staff maintain via UI afterward.

**API changes:**
- `InternalCollectionSerializer` — read: array of `{ id, display_name, full_name, slug }` + `citation_author_names`; write: `citation_authors: [id, ...]` (via `create`/`update` override same pattern as Collaborator languages)
- `InternalCollectionViewSet` — new `GET .../suggested-citation-authors/` action (computes from items, no persist); `perform_create`/`perform_update` now set `modified_by` (resolves tech-debt gap)
- `CollectionFilter.citation_authors_contains` — changed from text `icontains` to M2M name lookup (first/last/full name + `.distinct()`); keyword search updated to same
- Public API `CollectionDetailMetadataSerializer.citation_authors` — returns sorted name list from M2M

**Frontend:**
- `CollectionDetail` — "Citation Authors" card (was "Creators"); `EditableMultiRelationshipField` for manual add/remove via PATCH; "Populate from items" button (visible while editing) fetches `suggested-citation-authors` into edit draft; cancel discards; save persists. Help text explains replacement semantics.
- `CollectionCreate` — multi-select Autocomplete instead of free-text field
- `collectionExport.ts` — CSV "Citation Authors" column uses joined collaborator names from M2M
- `api.ts` — `CitationAuthorEntry` interface; `CollectionMutationData` type (`citation_authors?: number[]`); `getSuggestedCitationAuthors`

**Bug fixes in same session:**
- `EditableMultiRelationshipField.loadSelectedOptions` — now uses `id__in` query param (previously fetched page 1 of 100 unfiltered; populated chips vanished after mount)
- `EditableMultiRelationshipField` display mode — non-languoid chips now use inline `flexWrap: wrap` row (was `flexDirection: column`), matching `EditableMultiSelectField` and rest of UI

**Tests:** `metadata/tests/test_collection_citation_authors.py` (4 tests: filter, dedup, replace, sort).

**Rollout:** `python manage.py populate_collection_citation_authors` once per environment.

---

### Collections List — Table and Filter Simplification (2026-06-13)

**Scope:** React collections list page (`CollectionsList.tsx`) — narrower desktop table and advanced filter panel.

**Desktop table columns (fixed):** Abbreviation, Name, Date Range, Items. Removed Extent and Abstract columns (2026-06-13).

**Advanced filters (6 + keyword):** Collection Abbreviation, Collection Name, Access Level (multi-select), Language, Collaborator, Genre (multi-select). Keyword search unchanged (always visible).

**Removed from filter panel:** Extent, Abstract, Description, Date Range From/To, Citation Authors. Keyword `filter_keyword` still searches those text fields server-side.

**Backend:** New `collaborator_contains` on `CollectionFilter` — collections with FK-linked items whose collaborators match first/last/full name (`collection_items__collaborator__*`, `.distinct()`). Same name-matching pattern as Item `collaborator_contains`.

**Frontend:** Persisted state key bumped to `collection-list-state-v5` (from v4).

**Unchanged:** Mobile card view still shows extent/abstract chips and truncated abstract; no batch edit; client-side CSV export only.

### Collection Aggregate Automation (2026-05-27)

**Scope:** Unified Celery automation for all Collection fields derived from FK-linked items: `item_count`, `date_range_min/max` + display `date_range`, `access_levels`, `genres`, `languages` M2M.

**Design:**
- **Source of truth:** Items with `Item.collection` FK set (catalog-prefix `pre_save` assignment unchanged; ~35% of items may still lack FK — aggregates undercount until FK exists).
- **Policy:** Always recompute from current items; **clear all derived fields** when collection has zero FK-linked items (fixes stale date ranges on empty collections).
- **Dates:** `collection_date_*` and `accession_date_*` on items + existing `format_date_range()` — not `creation_date_*` (legacy `generatecollectionaggregatevalues` year-string logic retired).

**Implementation:**
- `metadata/services/collection_aggregates.py` — `update_collection_aggregates_for()`, `refresh_collections()`
- `metadata/services/collection_aggregate_scheduling.py` — Redis pending-ID set + quiet window (5s) + single flush task
- `metadata/tasks.py` — `update_collection_aggregates(collection_ids=None)`, `flush_collection_aggregate_updates()`; `update_collection_item_counts` / `update_collection_date_ranges` are thin wrappers
- **Triggers:** Item `post_save`/`post_delete`, Item.language `m2m_changed`, coalesced schedule; Item batch save skips per-row via `_skip_async_tasks` + one post-commit schedule with deduped collection IDs; `_previous_collection_id` on Item `pre_save` for FK moves
- **Queue:** `maintenance` Celery queue, priority **1** (does not compete with exports/cache warms on `private`/`public`)
- **Beat:** Single nightly `update-collection-aggregates` at 2:30 AM in `settings.py` `CELERY_BEAT_SCHEDULE` (replaces separate count + date jobs); removed duplicate beat block from `archive/celery.py`
- **Workers:** `dev.sh`, `docker-compose.private.yml`, `docker-compose.public.yml` — listen on `maintenance` queue
- **Commands:** `update_collection_aggregates` (new); `update_collection_counts`, `update_collection_dates`, `generatecollectionaggregatevalues` delegate to unified task (removed blocking `input()` from last)

**Tests:** `metadata/tests/test_collection_aggregates.py` (4 tests)

**Post-deploy:** Restart Celery workers to pick up `maintenance` queue; run `python manage.py update_collection_aggregates` once to backfill genres/access/languages on existing collections.

**Collections React CRUD gaps (identified same session, not fixed):** Detail uses missing `update_field` endpoint; ViewSet lacks `perform_create`/`perform_update` for `modified_by`; create form `languages` dropped by read-only serializer; detail shows raw access level codes — see Tech Debt.

### Items User Guide — End-User Documentation Parity (2026-05-26)

**Scope:** User-facing in-app help for Items brought to parity with Languoids and Collaborators (list, detail, CRUD, batch editor, import).

**New docs (`docs/user-guide/`):**
- `editing-items.md` — list UX (filters, columns, export, batch entry), detail field reference by card, create/delete, access level chips
- `batch-editor/item-batch.md` — ~60 batch columns, titles (two-slot limit), collaborators, catalog duplicates, collection behavior
- `batch-editor/importing-data-items.md` — catalog # reconciliation, export-only Collection, choice/title import rules

**Updated docs:**
- `getting-started.md` — top nav, Items overview
- `batch-editor/overview.md` — per-model guide links
- `batch-editor/importing-data.md` — model-specific table; languoid sections labeled
- Cross-links in languoid/collaborator single-edit and batch guides

**Frontend wiring:**
- `UserGuidePage.tsx` — registers Editing Items, Batch Editing Items, Importing Item Spreadsheets (10 sections total)
- `TanStackSpreadsheetWrapper.tsx` — `BATCH_EDITOR_GUIDE_ANCHORS` maps Items → `item-batch`, Collaborators → `collaborator-batch`, Languages → `languoid-batch` (fixes Items incorrectly linking to languoid batch doc; Languoid editor passes `modelName="Languages"`)

**Build/copy:** Markdown copied to `frontend/public/docs/` via `prestart`/`prebuild`; production via `npm run build:django` → `app/static-files/frontend/docs/`. Documented in `04-REFERENCE/frontend/app-shell-patterns.md`.

**Not in scope:** Collections user guide; InfoIconLink on list/detail pages (batch toolbar only, same as other models).

### Item Batch Editor — Import Title Column Reconciliation (2026-05-25)

**Problem (user-reported, reproduced):** Re-importing export files showed Default Title as `[object Object]` and marked empty First Additional Title as modified when DB had only a primary title.

**Root cause (not `parseTitleWithLanguage`):** `itemToSpreadsheetRow` in `itemImportTransformer.ts` diverged from `ItemBatchEditor.itemToRow` — used `value.toString()` on batch API `TitleWithLanguage` objects for display, and stored empty additional titles as `''` instead of `null`. Import comparison then saw `''` vs parsed empty `null` as a change.

**Design (unchanged):** Batch grid exposes **two** title slots only (`primary_title` = default ItemTitle, `secondary_title` = first non-default). Export may emit up to 10 additional title columns; only First Additional maps to batch import. More than two titles in DB is rare; detail page (`EditableTitlesList`) remains full CRUD.

**Fix:**
- `itemImportValueParsers.ts` — shared `normalizeTitleWithLanguageValue`, `formatTitleWithLanguageDisplay`, `isEmptyTitleWithLanguageValue`, `formatPrimaryTitleDisplay`; `areCellValuesEqual` treats empty title sentinels (`null`, `undefined`, `''`) as equivalent
- `itemImportTransformer.ts` — `itemToSpreadsheetRow` uses same title formatting/normalization as batch editor
- `api.ts` — `TitleWithLanguage` type; `Item.primary_title` / `secondary_title` typed for batch API shape
- `ItemDetail.tsx` — `formatPrimaryTitleDisplay` for header/delete dialog

**Verify:** Re-import export with Default Title populated and First Additional Title blank → readable title text, additional title not yellow/modified.

**Still open (parser, not reconciliation):** `parseTitleWithLanguage` edge cases — parentheses in title text, case-sensitive language name lookup, ambiguous language names (see Tech Debt).

### Item Batch Editor — Import Choice Field Validation (2026-05-25)

**Problem:** `fuzzy_match_choice` import (access level, resource type, condition, etc.) used `parseSelectChoice` silent pass-through on unknown labels. Import then called `validate-field`, which accepts any string on `item_access_level` (`CharField`, no choice enforcement) — invalid values showed **valid** until user edited the cell.

**Design:** Parser is authority for choice columns on import (same tier as live edit client rules). Unrecognized non-empty values → parser error, red cell, raw text preserved for correction. Backend `validate-field` must not run after parser error (including merge/update rows).

**Implementation:**
- `itemImportValueParsers.ts` — `parseSelectChoice` returns `errors: ["…" is not a valid choice]` when fuzzy/exact/label match all fail
- `itemImportTransformer.ts` — wire `choiceResult.errors` into `validationNeeded`; `queueValidationForChanges` skips fields with parser errors (aligned with existing `queueFullValidation`)

**Scope:** All Item import columns using `parser: 'fuzzy_match_choice'` (access level, resource type, type of accession, availability, condition, original format medium).

**Verify:** Import row with access level `"5"` or typo → red cell, save blocked; valid label or `"1"` still imports.

### Item Batch Editor — List Handoff Row Order (2026-05-25)

**Problem:** Returning from the item list via Batch Edit Selected/Filtered showed rows in checkbox Set insertion order (persisted in `item-list-state`), which could match a previous batch session and feel like stale grid order — not catalog # order from the list.

**Design — two order rules (intentional):**
- **In-session (batch editor):** Preserve grid order — import appends at bottom, manual refresh walks `rowsRef`, save appends new IDs to `config.ids` for F5. No resort during editing.
- **List → batch handoff:** Any batch-edit button press is a new session boundary. `config.ids` sorted by case-insensitive `catalog_number` before navigate. Matches item list API (`Lower('catalog_number')`) and full cache order.

**Implementation:**
- `frontend/src/utils/itemBatchOrder.ts` — `sortItemIdsByCatalogNumber`
- `ItemsList.tsx` — sort on selected mode, filtered dialog continue, and auto-proceed paths before writing `item-batch-config`
- `ItemBatchEditor.loadItems` already iterates `config.ids` in order — no editor change

**Scope:** Item only. Collaborator/Languoid lists still use Set/cache order at handoff.

**Verify:** Batch edit with overlapping selections checked in non-catalog order → grid follows catalog #; import still adds rows at bottom within same session.

### Item Batch Editor — Duplicate Catalog Number Handling (2026-05-25)

**Problem:** Same catalog # twice in one import file created multiple grid rows (transformer only matched `currentRows`, not rows already produced in that import). Multi-cell paste could assign the same catalog to several rows with no grid-uniqueness check.

**Design:**
- **Import file duplicates:** User's file problem — not a save blocker. **Last file row wins**; one grid row per catalog; post-import **dialog** lists superseded file row numbers.
- **Grid duplicates (live edit, single-cell paste, multi-cell paste):** **First row in grid order wins**; later rows get invalid catalog cell (same error as live typing). Backend cache check still runs for survivors.
- **Do not merge silently without telling the user** on import; do not allow two grid rows with the same catalog # at save time.

**Implementation:**
- `frontend/src/services/catalogUniqueness.ts` — shared normalize, grid duplicate scan, client validation helpers
- `itemImportTransformer.ts` — lookup `currentRows` → `newRows` → DB; in-file merge; `fileCatalogDuplicates` on `ImportResult`
- `ItemBatchEditor.tsx` — `validateField` uses helper; `handleBatchCellChange` post-pass after catalog paste
- `TanStackSpreadsheetWrapper.tsx` — optional `onImportComplete`; Item shows duplicate dialog

**Verify:** Import file with same catalog on rows 5 and 20 → one row, dialog; range-paste catalog to 3 rows → first valid, others red; type duplicate on second draft → second red (unchanged).

### Item Batch Editor — Collection FK Not Imported (2026-05-25)

**Symptom:** Save blocked with validation dialog: `Incorrect type. Expected pk value, received str.` on rows such as `FFE-00017`, while catalog # cells looked correct (red/yellow). Not a catalog-number bug.

**Root cause:** Export includes a **Collection** column (`collection_abbr`, e.g. `FFE`) for reporting. Import mapped it as a writable field, parsed abbr as text, and ran `validate-field` on `Item.collection` FK — DRF expects a numeric PK. Batch grid intentionally has **no** Collection column; invalid state lived in hidden `cells.collection`.

**Design (aligned):**
- `Item.collection` FK is **optional** (`null=True`, `blank=True`).
- Staff catalog convention `ABC-###` → association in Django **`pre_save`** (`update_item_date_ranges` in `signals.py`): 3-letter prefix → `Collection.objects.get(collection_abbr=…)` or `None` if no match; non-matching pattern leaves FK unchanged.
- Batch editor does **not** expose collection for edit. Payload should omit `collection` when unchanged; **save-batch** only sends `ITEM_COLUMNS` fields.

**Fix:**
- `ImportColumnConfig.skipImport` — export/reporting columns recognized in import UI but not parsed or validated.
- `collection` uses `skipImport: true` in `itemImportColumnMapper.ts`; `parseCellValues` skips in `itemImportTransformer.ts`.
- `docs/system-behavior/batch-editor/validation.md` — export-only row in comparison table + import note.

**Verify:** Hard refresh after deploy; re-import export with Collection column; save should succeed; FK set on save from catalog prefix when collection exists.

### Item Import Draft-Row Validation (2026-05-25)

**Problem:** Item import hook shipped with a dead `isNewRow` branch (`rowId.startsWith('new-')`) while all draft rows use `draft-{uuid}`. Docs said new import rows skipped backend validation; code actually ran backend for draft rows anyway — inconsistent and misleading.

**Design aligned (session):**
- **Import draft row** (`draft-{uuid}`, data from spreadsheet): validate **field values**, not “the row object in DB.” Parsers for composite columns; backend `validate-field` for direct model fields (same skip list as existing rows). Catalog # in DB → **match and load row** (CASE 2 in transformer), not red as duplicate.
- **Live edit blank draft** (`hasChanges: false`, Add row button): defer required-field errors until user edits — **separate path**, unchanged.

**Implementation:**
- `useImportItemSpreadsheet.ts` — removed broken skip-all branch; unified import loop (parser error → invalid; skip list → valid; else backend); `getImportOriginalValue()` passes `original_value` on re-import
- `validationAPI.ts` — `validateItemField` accepts optional `originalValue`
- `InternalItemViewSet.validate_field` — catalog uniqueness uses `draft-` prefix (aligned with Collaborator/Languoid and `save-batch`), not stale `new-`
- `docs/system-behavior/batch-editor/validation.md` — editor comparison table, import diagram, draft-row notes updated

**Next on Item batch editor:** Column-specific import parser fixes per user feedback (collaborators, languages, title parentheses/language lookup, etc.) — see Tech Debt / open gaps below. Choice/select import (`fuzzy_match_choice`) and title import reconciliation fixed 2026-05-25.

### Batch Editor Validation Documentation (2026-05-24)

**Canonical developer doc:** `docs/system-behavior/batch-editor/validation.md` — live edit, import, and save validation for Languoid, Collaborator, and Item batch editors.

**Contents:**
- Mermaid flow diagrams (small graphs, `curve: linear`, diagram authoring rules for LLM/human updates)
- Editor comparison table (live vs import vs save; per-model `validate-field` usage)
- Maintenance checklist mapping code changes to doc sections

**Repo docs updated:** `docs/system-behavior/batch-editor/README.md`, `editing-features.md` (validation section deferred to canonical doc), `docs/README.md` index. Fixes broken link from `delete-key-implementation.md`.

**Context cross-links:** `02-PATTERNS/batch-editors.md`, `03-LESSONS/item-batch-editor.md`, `04-REFERENCE/docs-directory.md`, `context-map.md`.

**Design framing:** Tiered validation is **intentional** (client live, backend import, serializer save) — not tech debt. See `validation.md` § Intentional design.

### Pin PostgreSQL Docker Image to 17 (2026-05-24)

**Incident:** Production TrueNAS deploy (May 2026) — login failed with `could not translate host name "db"`. Root cause: Postgres container exited after TrueNAS app restart pulled `postgres:latest` (PG 18+), which rejects existing volume data at `/var/lib/postgresql/data/`.

**Not caused by:** Application code changes (field removal, migrations, frontend). Infrastructure — unpinned `image: postgres` in compose.

**Timeline context:**
- Production volume created with PG 17 (Mar–Nov 2025 when `latest` was still 17)
- Docker Hub `latest` switched to PG 18 on **Sep 25, 2025**; Nov 2025 production still worked on cached PG 17 image
- May 2026 Stop/Start pulled fresh `latest` (18.x) → Postgres exit loop → web can't reach `db`

**Fix:** Pin `image: postgres:17` in `docker-compose.private.yml`, `docker-compose.public.yml`, `docker-compose.yml`. Documented in `docs/deployment/database-operations.md`.

**Recovery on TrueNAS:** Pull pin → Stop/Start app → verify Postgres running → `python manage.py migrate`.

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

**Collections (2026-05-27 audit — CRUD wiring, not aggregates):**
- `CollectionDetail` calls `POST …/collections/{id}/update_field/` but `InternalCollectionViewSet` has no such action (Item/Collaborator/Languoid use `PATCH`) — citation_authors now uses `collectionsAPI.patch`; other scalar fields still on `update_field`
- List export CSV omits genres/access levels/languages; list row checkboxes disabled (`selectable={false}`) so Export Selected has no UI

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
- Virtual fields need parser validation, skip backend validation on import
- **Tiered batch validation (intentional):** client-heavy live edit, backend `validate-field` on import, `save-batch` serializer on save — Item/Collaborator differ from Languoid live debounce by design (scale + composite fields); see `docs/system-behavior/batch-editor/validation.md`
- **Import draft vs blank live draft:** Same `draft-{uuid}` id, different semantics — import drafts have spreadsheet data and get field validation; Add-row blanks use `hasChanges: false` to defer errors until edit. Do not conflate.
- **Import catalog match:** Existing catalog # in DB loads/updates that item (transformer CASE 2), not a duplicate error. Red catalog # = uniqueness conflict (e.g. changing to another item's number), not “item exists.”
- **Import file duplicate catalog #:** Last file row wins → one grid row; dialog warns with superseded file row numbers — not an error, not two rows.
- **Grid catalog uniqueness:** First grid row with a catalog # wins; shared logic in `catalogUniqueness.ts` (live edit, paste post-pass).
- **Item.collection is not a batch field:** Export may include Collection abbr; import must `skipImport` — FK from `catalog_number` on `pre_save` only, not `validate-field` or spreadsheet cells.
- **Import choice fields (`fuzzy_match_choice`):** `parseSelectChoice` must error on unknown labels — do not rely on `validate-field` for choice enforcement (serializer uses plain `CharField`). `queueValidationForChanges` must skip backend when parser already failed.
- **Import title reconciliation:** `itemToSpreadsheetRow` must match `ItemBatchEditor.itemToRow` for `primary_title` / `secondary_title` — never `value.toString()` on title objects; empty titles are `null` not `''`. Shared helpers in `itemImportValueParsers.ts`. Grid shows `cell.text`, not raw object.
- **Batch title columns (intentional):** Two editable slots only; export may have more additional-title columns; detail page manages all ItemTitle rows.
- UUID + timestamp hybrid works best for export IDs

### Performance Baselines
- Cache build: 15-20 seconds (one-time)
- Cache hit: <1 second
- Save batch: <2 seconds
- Async export: ~18 seconds for 4,400 rows

## Tech Debt (Not Blocking)

**Collections React CRUD parity (partially resolved 2026-06-21):**
- `perform_create`/`perform_update` added to `InternalCollectionViewSet` — resolved
- `citation_authors` now uses `collectionsAPI.patch` — resolved
- Remaining: switch all scalar field edits from `update_field` to `PATCH`; use `access_levels_display` not raw codes; remove dead `saveField` branches for read-only aggregates (`languages`, `genres`, `access_levels`)
- Optional: `Item.collection` FK backfill job (catalog prefix → FK) — improves aggregate accuracy without new Collection fields
- Optional: align `Collection.export_metadata()` JSON with full serializer fields; list CSV export columns

**Item batch editor import (known gaps, user feedback in progress):**
- Parser edge cases: ambiguous collaborator names dropped (not `id: null` preserved); languoid name lookup case-sensitive / no uniqueness check; **title import parser** — parentheses in title text, case-sensitive language name lookup, ambiguous language names (`parseTitleWithLanguage`; reconciliation/display fixed 2026-05-25); collaborator comma splitting
- Live edit: lat/lng range not checked client-side (import/save backend does); see `validation.md` § Optional enhancements

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

### Pin PostgreSQL to postgres:17 (2026-05-24)

All compose files use `image: postgres:17` — never unpinned `postgres` or `postgres:latest`.

**Why?** Production volumes use pre-PG-18 data layout (`/var/lib/postgresql/data`). Docker Hub `latest` is PG 18+ (since Sep 2025); PG 18+ images refuse that mount path without migration.

**Alternatives considered:**
- Pin only private compose: Rejected — dev/public would still risk wrong version on fresh installs
- Upgrade to PG 18 now: Rejected — requires `pg_upgrade` + volume path change; emergency recovery needed PG 17

**Trade-off accepted:** Must explicitly bump major version and run `pg_upgrade` when upgrading Postgres; no automatic `latest` tracking.

### Batch Editor Tiered Validation Is Intentional Design (2026-05-25)

Live edit (client-heavy on Item/Collaborator), import (backend `validate-field`), and save (`save-batch` serializer) are **different tiers on purpose** — not debt to unify with Languoid live debounce.

**Why?** Forensic review (code since Nov 2025 Item ship + `performance.md`): per-keystroke backend validation at Item scale is costly; virtual/composite fields require parsers/custom editors; save remains authoritative.

**Alternatives considered:**
- Treat as tech debt and add live `validate-field` for all Item fields: Rejected — misread of original design; performance and virtual-field constraints remain
- Remove import/save backend validation: Rejected — would weaken data integrity

**Trade-off accepted:** Some Django rules (e.g. lat/lng range) may only surface at import/save unless client rules extended; optional enhancements listed in `validation.md`.

**Docs:** Removed “two validation paths” from Tech Debt in `active-work.md`; reframed in `docs/system-behavior/batch-editor/validation.md`.

### Item Import Draft-Row Validation Policy (2026-05-25)

Import draft rows (`draft-{uuid}`) validate **field values** via parsers + backend `validate-field` (same composite skip list as existing rows). Do not skip all backend for new import rows. Do not treat “row exists in DB” as an import error — match by catalog # and merge.

**Why?** New row = no DB object yet, but imported cells still need vocabulary/format/uniqueness checks. Blank Add-row UX (`hasChanges: false`) is live-edit only.

**Alternatives considered:**
- Skip all backend for import drafts (broken `new-` branch / original Nov 2025 intent): Rejected — too loose; conflated with blank-row UX
- Always identical to Languoid with no Item-specific import design: Rejected — composite columns require parser-first skip list; Item leads other editors here

**Trade-off accepted:** Item import policy documented first; Languoid/Collaborator unchanged until ported. Column parser quality remains the main import UX lever for composite fields.

### Item Collection FK — Backend Only, Not Batch Import (2026-05-25)

`Item.collection` is derived from `catalog_number` prefix (`ABC-###`) in `pre_save`, not edited or validated in the batch grid. Export includes Collection abbr for reporting; import uses `skipImport` so abbr is not sent to `validate-field` as a FK.

**Why?** Avoid circular validation (spreadsheet abbr vs PK vs signal); one automation path on save; graceful `None` when abbr has no Collection row (~65% of items may lack FK until prefix matches — data-quality signal).

**Alternatives considered:**
- Collection column in batch editor: Rejected — user protocol is catalog naming; FK is derived
- Import abbr and resolve to PK in frontend: Rejected — duplicates signal logic; caused PK type errors
- `validate-field` on collection during import: Rejected — conflicts with export-only column

**Trade-off accepted:** Re-importing export files ignores Collection column values for writes; displayed abbr may differ until next save recalculates FK from catalog #.

### Item Catalog Duplicate Policy — Import vs Grid (2026-05-25)

Duplicate catalog numbers are handled differently by **source**, not one universal merge rule.

**Import file (same catalog on multiple rows):** Last file row wins; one grid row; informational dialog (superseded file row numbers). Not a save blocker — bad spreadsheet data, user informed.

**Grid (typing, single-cell paste, multi-cell paste):** First row in grid order keeps valid catalog; later rows invalid with “already used in another row.” Save blocked via `hasErrors`. Backend cache uniqueness still checked for survivors.

**Why?** Import row-matching (`CASE 1`) already updates existing rows; within-file repeats must not spawn second rows. Grid integrity requires no two editable rows sharing a catalog # before save.

**Alternatives considered:**
- Silent merge on import with no dialog: Rejected — user must know file had duplicates
- Block import on file duplicates: Rejected — user may fix source file later; last row is sufficient default
- Same “first wins” on import file order: Rejected — last row matches spreadsheet “final truth” when users repeat rows

**Trade-off accepted:** Import last-wins vs grid first-wins is intentional; shared helpers in `catalogUniqueness.ts`, not identical rules.

### Item Batch Row Order — List Handoff vs In-Session (2026-05-25)

Row order follows **context**, not one global rule.

**List handoff (Batch Edit Selected/Filtered/Empty with IDs):** Sort IDs by case-insensitive catalog # when writing `item-batch-config`. Aligns batch grid with item list and cache (both `Lower('catalog_number')` on internal API).

**In-session:** Order-preserving refresh, import-at-bottom, and post-save `config.ids` append — unchanged. F5 within same session keeps that shape.

**Why?** Leaving for the list and pressing batch edit is a deliberate new working set; checkbox check order is not list order. Staying in the editor, users expect stable row positions.

**Alternatives considered:**
- Sort in `ItemBatchEditor` on every load: Rejected — would resort after import/F5 within same session
- Use `config.timestamp` in editor to gate resort: Rejected — list-side sort is simpler; Item editor already honors `config.ids` sequence
- Fix all three batch editors now: Deferred — Item only; Collaborator/Languoid still filter by ID set in cache order

**Trade-off accepted:** Item handoff uses catalog sort; Collaborator/Languoid unchanged until ported.

### Item Import Title Reconciliation (2026-05-25)

`itemToSpreadsheetRow` (DB cache match on import) must produce the same cell `text`/`value`/`originalValue` as `ItemBatchEditor.itemToRow` for `title_with_language` columns.

**Why?** Batch API returns `primary_title` / `secondary_title` as `{ title, language }` objects. Grid displays `cell.text`. Generic `.toString()` yields `[object Object]`. Empty additional title must be `null` so import empty cells (`null`) do not false-positive as changes against legacy `''`.

**Alternatives considered:**
- Fix display only in grid renderer: Rejected — import comparison and `originalValue` still wrong
- Map export's 2nd–10th additional title columns into batch grid: Rejected — deliberate two-column compromise; rare data

**Trade-off accepted:** Re-import ignores export columns beyond First Additional Title; detail page for full title CRUD.

### Items User Guide Parity (2026-05-26)

End-user documentation for Items matches Languoid/Collaborator coverage: single-edit guide, batch guide, import guide, in-app registration, batch editor info-icon links.

**Why?** Item batch editor shipped without staff-facing docs; batch toolbar linked Items to languoid batch help.

**Alternatives considered:**
- Single generic batch import doc for all models: Rejected — Item match key (catalog #), Collection skipImport, and title rules differ too much
- InfoIconLink on every list/detail page now: Deferred — other models only use batch toolbar link

**Trade-off accepted:** Three new markdown files (~large editing-items.md); `importing-data.md` remains languoid-centric body with explicit per-model index at top.

### Collection Aggregate Automation (2026-05-27)

Unified derived-field recompute from FK-linked items; coalesced event-driven updates; `maintenance` queue at low priority.

**Why?** Genres, access levels, and languages were manual/`generatecollectionaggregatevalues` only; date/count jobs scanned all collections on every item change and left stale data on empty collections.

**Alternatives considered:**
- Separate nightly tasks per field: Rejected — duplicate loops, same item queryset
- Keep languages staff-curated on create form: Rejected — inconsistent with access_levels/genres rollup semantics; aggregates overwrite on first item link
- Per-collection debounce only (no Redis ID set): Rejected — batch edits across collections still spawned multiple full scans before batch-end hook

**Trade-off accepted:** Aggregates ignore items without Collection FK; staff-edited collection `languages` on create are overwritten once items exist; aggregate saves trigger private-server JSON export (existing `Collection.save()` behavior).

### Collection `citation_authors` M2M Conversion (2026-06-21)

Converted `Collection.citation_authors` from `TextField` to `ManyToManyField(Collaborator)`.

**Why?** Free text was unstructured and unlinked to actual Collaborator records. M2M enables the populate-from-items workflow and consistent name display.

**Alternatives considered:**
- Populate via Celery aggregate (nightly + item save hook): Rejected — citation authors are staff-curated with optional one-time backfill; auto-overwrite on item change would erase manual edits
- Union populate (merge with existing): Rejected — replace matches command behavior and is simpler

**Trade-off accepted:** Old free-text values dropped on migration (no backfill attempt); populate only reaches items with `Item.collection` FK set (~65% today, same caveat as other aggregates).

**Service module justified by multiple consumers:** `order_collaborators_by_last_name` is used by `InternalCollectionSerializer` and `CollectionDetailMetadataSerializer`; `compute_citation_authors_for_collection` is used by the `suggested-citation-authors` API action; `apply_citation_authors_to_collection` is used by the management command. A service with multiple real consumers is not over-abstraction. If compute/apply were only used by the command, the logic would live inline in the command (management commands are leaf nodes — nothing imports from them).

### Collection List Filter Set (2026-06-13)

Staff-facing advanced filters limited to abbreviation, name, access level, language, collaborator, and genre.

**Why?** Reduce filter-panel clutter; align with how staff actually narrow collections. Extent/abstract/description/dates/citation authors remain reachable via keyword search.

**Alternatives considered:**
- Keep all 2026-05-23 filters in panel: Rejected — too many fields for typical list workflows
- Remove keyword cross-field search: Rejected — still needed for free-text discovery

**Trade-off accepted:** No dedicated date-range or citation-author filters in panel; `collaborator_contains` matches via item FK only (~35% of items may lack Collection FK — same aggregate undercount signal).

### Collection Item Collaborators Rollup (2026-06-22)

Read-only overview chips aggregating `CollaboratorRole` across FK-linked items; computed at API read time via `collection_item_collaborators.py`.

**Why?** Staff need a collection-level view of who worked on items and in what roles, distinct from citation-author curation.

**Alternatives considered:**
- Celery aggregate field on `Collection`: Rejected — display-only, not used for filtering/export; would blur semantics with `citation_authors` and stored aggregates
- Reuse `citation_authors` M2M or populate button: Rejected — different meaning (all roles vs citation subset; curated vs derived)
- Shared role-display helper across all six existing read paths (item detail serializer, exports, batch, list): Rejected for now — blast radius too large; paths have subtle differences

**Trade-off accepted:** Role label mapping is **collection-chip-specific** (strip + case-insensitive lookup); item detail, exports, and batch paths unchanged. Legacy malformed role strings may still show raw on collection chips.

## Files Recently Modified

**Collection item collaborators rollup (2026-06-22, since commit `da90823`):**
- `app/metadata/services/collection_item_collaborators.py` — New
- `app/metadata/tests/test_collection_item_collaborators.py` — New
- `app/internal_api/serializers.py` — `InternalCollectionSerializer.item_collaborators`
- `frontend/src/services/api.ts` — `CollectionItemCollaborator` type; `item_collaborators` on `Collection`
- `frontend/src/components/collections/CollectionDetail.tsx` — Collaborators overview section
- `frontend/src/utils/collaboratorRoleChip.ts` — New; chip label + `sx`
- `frontend/src/components/common/EditableCollaboratorRolesField.tsx` — uses shared chip label/`sx` (display only; no role-mapping change)
- `context/` — active-work, backend.md, data-models.md, README version history

**Collection citation_authors M2M (2026-06-21):**
- `app/metadata/models.py` — `citation_authors`: TextField → M2M to Collaborator
- `app/metadata/migrations/0107_collection_citation_authors_m2m.py` — New
- `app/metadata/services/collection_citation_authors.py` — New
- `app/metadata/management/commands/populate_collection_citation_authors.py` — New
- `app/metadata/tests/test_collection_citation_authors.py` — New
- `app/internal_api/serializers.py` — `InternalCollectionSerializer` M2M read/write + `create`/`update` override
- `app/internal_api/views.py` — `suggested-citation-authors` action; `perform_create`/`perform_update`; M2M citation_authors and keyword filters
- `app/api/v1/serializers/collections.py` — `citation_authors` as sorted name list from M2M
- `frontend/src/services/api.ts` — `CitationAuthorEntry`; `CollectionMutationData`; `getSuggestedCitationAuthors`
- `frontend/src/components/collections/CollectionDetail.tsx` — Citation Authors card; populate button + help text; draft state; `citationAuthorsDraft`
- `frontend/src/components/collections/CollectionCreate.tsx` — Collaborator multi-select instead of text field
- `frontend/src/utils/collectionExport.ts` — Export names from M2M
- `frontend/src/components/common/EditableMultiRelationshipField.tsx` — `id__in` fetch in `loadSelectedOptions`; inline chip display for non-languoid fields
- `context/` — active-work, backend.md, data-models.md, README version history

**Collections list table and filters (2026-06-13):**
- `frontend/src/components/collections/CollectionsList.tsx` - Removed extent/abstract table columns; filter panel narrowed to 6 advanced filters; `collection-list-state-v5`
- `app/internal_api/views.py` - `CollectionFilter.collaborator_contains` + `filter_collaborator`
- `context/` - active-work, backend.md, list-page-patterns.md, README version history

**Collection aggregate automation (2026-05-27):**
- `app/metadata/services/collection_aggregates.py`, `collection_aggregate_scheduling.py` - New
- `app/metadata/tasks.py` - `update_collection_aggregates`, `flush_collection_aggregate_updates`; wrappers for legacy task names
- `app/metadata/signals.py` - Item aggregate scheduling; `_previous_collection_id`; `_skip_async_tasks`; language M2M hook
- `app/internal_api/views.py` - Item batch save post-commit aggregate schedule
- `app/metadata/management/commands/update_collection_aggregates.py` - New; counts/dates/generatecollectionaggregatevalues delegate
- `app/metadata/tests/test_collection_aggregates.py` - New
- `app/archive/settings.py` - Unified beat schedule; `COLLECTION_AGGREGATE_TASK_ROUTES`; `maintenance` queue
- `app/archive/celery.py` - Removed duplicate `beat_schedule` block
- `dev.sh`, `docker-compose.private.yml`, `docker-compose.public.yml` - `maintenance` queue on workers
- `context/` - active-work, backend.md, README version history

**Items user guide (2026-05-26):**
- `docs/user-guide/editing-items.md`, `batch-editor/item-batch.md`, `batch-editor/importing-data-items.md` - New
- `docs/user-guide/getting-started.md`, `batch-editor/overview.md`, `batch-editor/importing-data.md` - Updated
- `docs/user-guide/editing-languoids.md`, `editing-collaborators.md`, `batch-editor/languoid-batch.md`, `collaborator-batch.md` - Cross-links
- `frontend/src/pages/UserGuidePage.tsx` - New sections
- `frontend/src/components/batch/TanStackSpreadsheetWrapper.tsx` - Guide anchor map
- `frontend/src/components/common/InfoIconLink.tsx` - JSDoc examples
- `context/` - active-work, app-shell-patterns, docs-directory, README version history

**Item import title reconciliation (2026-05-25):**
- `frontend/src/services/itemImportValueParsers.ts` - Title normalize/format helpers; empty-title equivalence in `areCellValuesEqual`
- `frontend/src/services/itemImportTransformer.ts` - `itemToSpreadsheetRow` title handling aligned with batch editor
- `frontend/src/services/api.ts` - `TitleWithLanguage` type; Item title field types
- `frontend/src/components/items/ItemDetail.tsx` - `formatPrimaryTitleDisplay`
- `docs/system-behavior/batch-editor/validation.md` - Import title reconciliation note
- `context/` - active-work, batch-editors, item-batch-editor §5g, README version history


**Item import choice validation (2026-05-25):**
- `frontend/src/services/itemImportValueParsers.ts` - `parseSelectChoice` errors on unrecognized values
- `frontend/src/services/itemImportTransformer.ts` - Wire choice parser errors; `queueValidationForChanges` skips parser-failed fields
- `docs/system-behavior/batch-editor/validation.md` - Import choice validation note

**Item batch list handoff row order (2026-05-25):**
- `frontend/src/utils/itemBatchOrder.ts` - Sort item IDs by catalog # for batch config
- `frontend/src/components/items/ItemsList.tsx` - Sort IDs on all batch-edit handoff paths

**Item catalog duplicate handling (2026-05-25):**
- `frontend/src/services/catalogUniqueness.ts` - Shared catalog normalize, grid duplicate scan, client validation
- `frontend/src/services/itemImportTransformer.ts` - Lookup includes `newRows`; in-file merge; `fileCatalogDuplicates` report
- `frontend/src/components/items/ItemBatchEditor.tsx` - Helper in `validateField`; paste post-pass; import duplicate dialog
- `frontend/src/components/batch/TanStackSpreadsheetWrapper.tsx`, `AdaptiveSpreadsheetGrid.tsx` - Optional `onImportComplete`
- `docs/system-behavior/batch-editor/validation.md` - Import duplicate + grid uniqueness notes

**Item collection import skip (2026-05-25):**
- `frontend/src/services/itemImportColumnMapper.ts` - `skipImport` on `ImportColumnConfig`; `collection` export-only
- `frontend/src/services/itemImportTransformer.ts` - `parseCellValues` skips `skipImport` columns
- `docs/system-behavior/batch-editor/validation.md` - Collection export-only import note

**Item import validation (2026-05-25):**
- `frontend/src/hooks/useImportItemSpreadsheet.ts` - Unified import validation loop; removed dead `new-` skip branch; `original_value` on import
- `frontend/src/services/validationAPI.ts` - `validateItemField` optional `originalValue`
- `app/internal_api/views.py` - Item `validate_field` catalog uniqueness uses `draft-` prefix
- `docs/system-behavior/batch-editor/validation.md` - Import draft-row behavior and comparison table

**Documentation (2026-05-24–25):**
- `docs/system-behavior/batch-editor/validation.md` - Canonical validation flows (Mermaid); tiered design + import draft rows (2026-05-25)
- `docs/system-behavior/batch-editor/README.md`, `editing-features.md`, `docs/README.md` - Index and deferral to validation.md
- `context/00-ESSENTIAL/active-work.md`, `02-PATTERNS/batch-editors.md` - Removed validation from Tech Debt; added decision + key learning

**Infrastructure (2026-05-24):**
- `docker-compose.private.yml`, `docker-compose.public.yml`, `docker-compose.yml` - Pin `postgres:17`
- `docs/deployment/database-operations.md` - PostgreSQL version pinning section

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
