# Preservation constraints

**Context note (2025-01-04, revised periodically):** Checklist of functionality that must not break during refactors. **Operational truth** is the codebase and deploy; re-verify with `security.md` when permissions or URL surfaces change.

**When to read this:** Before refactors that touch models, public API shapes, legacy Django UI, imports/exports, Celery, or storage paths.

---

## Core data models (preserve_001)

- All existing **data models and relationships** must remain functional during refactoring.
- **Critical models:** Item, Collection, Collaborator, Languoid, Document (legacy, in transition), File (replacing Document for ingestion), Geographic, CollaboratorRole.
- **Constraints:** `Item.catalog_number` must remain **unique** across all Items.
- **Relationships:** Preserve M2M between Items–Collaborators, Items–Languages (Languoids), Collections–Languages.

---

## Choice field stability (preserve_002)

Choice field constants are **controlled vocabularies** in production data. Do not rename or reorder carelessly.

- ACCESS_CHOICES (access levels)
- RESOURCE_TYPE_CHOICES (content types)
- GENRE_CHOICES (content genres)
- ROLE_CHOICES (collaborator roles)
- LANGUAGE_DESCRIPTION_CHOICES (linguistic categories)

---

## Authentication and permissions (preserve_003–005)

- **Group-based access** must continue to work. Legacy JSON listed Archivist/Admin; current groups and logic are documented in **`security.md`** (Administrator/superuser, Archivist, Museum Staff, Read-Only).
- **Template views:** Session auth (`@login_required`, `LoginRequiredMixin`, etc.), Django auth views, password change.
- **Login flow:** `/accounts/login/`, `/accounts/logout/` (and React auth routes as implemented).
- **Public API:** OAuth2 via `oauth2_provider`; permission patterns such as `IsAdminOrHasToken` for versioned public read API. Staff may access API via session where configured.

---

## Legacy Django template UI (preserve_006)

Template-based staff UI must remain **functional** for preservation and comparison. In production these routes live under the **`/django/`** prefix (see `app/archive/urls.py` and `system-overview.md`), including:

- Item catalog CRUD (`django/catalog/...`, list/index under `django/items/` and related paths)
- Collections, collaborators, languoids, documents CRUD
- Import paths (e.g. `django/catalog/import/`, collaborator/language import)
- Column export and Excel/metadata export flows
- Bootstrap-based template navigation where still in use

Do not remove or break these surfaces without an explicit migration and sign-off.

---

## Search and filtering (preserve_007)

Preserve capabilities staff rely on:

- Multi-field item search and complex filters
- Pagination (historically ~100 items per page on templates; React may differ—do not reduce capability without replacement)
- Column selection for exports, sort options, filter persistence where implemented
- Text contains, date ranges, choice filters, related-model filters

---

## Import and export (preserve_008–009)

- **Excel export** with custom column selection (`Columns_export` model), filtered export, openpyxl-based generation where applicable.
- **Imports:** Item catalog, collaborator, language/languoid, document upload flows; `ImportView` and Excel parsing/validation patterns.

---

## Public REST API (preserve_010)

Existing **versioned public** DRF endpoints must remain **backward compatible** (additive changes preferred).

- Typical resources: items, collections, languoids, collaborators under `/api/v1/...` (and documented schema endpoints).
- Features: pagination, filtering, OpenAPI at `/api/docs/` (and v1-specific docs), OAuth2 for privileged access, versioning strategy per **`endpoint-catalog.md`**.

---

## Background processing (preserve_011)

- Celery infrastructure and scheduled tasks must keep working.
- **Named examples (verify names in code):** `update_collection_item_counts` (daily), `cleanup_temp_files` (periodic), collaborator export tasks, file processing tasks.
- **Queues:** Role-based routing (`public` / `private` / `common`) per `infrastructure.md`.

---

## File handling and Document→File (preserve_012–013)

- During Document→File transition: existing Document records and CRUD must remain accessible; associations to Items preserved; metadata extraction preserved where applicable.
- Migrations should be **reversible** and not lose information.
- **Libraries called out:** mutagen (audio metadata), librosa (audio analysis), openpyxl (Excel).

---

## Geographic (preserve_014)

- Lat/long storage, multiple points per item where supported, map visualization, geographic CRUD (templates and/or React).

---

## Data validation (preserve_015–016)

- **`validate_date_text()`** and flexible date behavior must continue to work for cultural-archive date entry.
- **Unique fields:** `Item.catalog_number`, `Collection.collection_abbr`, UUID fields across models—maintain DB and application-level consistency.

---

## Production and compatibility (preserve_017–020)

- Production data: changes must be **backward compatible**; migrations tested and reversible where possible.
- **Error UX:** Custom pages/handlers (e.g. 500, 403, `no_permission.html`) and related view hooks should remain unless deliberately replaced.
- **Refactoring:** Preserve URL contracts, API response shapes, field names/types, and storage paths unless versioned or coordinated. Prefer incremental migration with rollback.

---

## Related docs

- `security.md` — current permission matrix
- `infrastructure.md` — deployment, storage, Celery
- `system-overview.md` — stack, API overview
- `04-REFERENCE/api-docs/endpoint-catalog.md` — public vs internal endpoints
