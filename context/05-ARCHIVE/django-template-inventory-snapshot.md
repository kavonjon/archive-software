# Django template inventory (2025-01-04 snapshot)

**Context note (2025-01-04, revised periodically):** One-time **Stage 0** snapshot of template-era CRUD so React could reach parity. **Today:** treat as **stale in detail**; URL prefixes live under **`/django/`**; languoid detail uses **string** PK (glottocode). **Dialect / DialectInstance** template flows are **obsolete** (model removed 2025-11-08). For current routes, use **`app/archive/urls.py`**.

**Purpose of original file:** List Django template CRUD, filters, and supporting views so React could reach parity.

---

## Core template surfaces (conceptual)

| Area | Legacy JSON path hint | Current production prefix (typical) |
|------|----------------------|-------------------------------------|
| Items | `catalog/` | `django/items/`, `django/catalog/...` |
| Collections | `collections/` | `django/collections/...` |
| Collaborators | `collaborators/` | `django/collaborators/...` |
| Languoids | `languoids/<int:pk>/` | `django/languoids/<str:pk>/...` |
| Documents | `documents/` | `django/documents/...` |

## Item list filters (historical parameter names from template era)

`catalog_number_contains`, `item_access_level_contains`, `call_number_contains`, `accession_date_min/max`, `indigenous_title_contains`, `english_title_contains`, `titles_contains`, `resource_type_contains`, `language_contains`, `creation_date_min/max`, `description_scope_and_content_contains`, `genre_contains`, `collaborator_contains`, `depositor_name_contains`, `keyword_contains`.

Verify against `item_index` / internal API if refactoring search.

## Supporting views (still relevant)

- Geographic add/edit under item/document parents
- Collaborator role edit
- Columns export CRUD
- Import views and document upload
- Collaborator async export + download + cleanup URLs (also at non-`django/` paths in root `urls.py`—check live file)

## Stage 0 requirements (as captured 2025-01-04)

**Must recreate:** list/detail CRUD, permissions, related navigation, pagination, messages, validation.

**Originally “defer”:** some export/async/file features—many were implemented earlier than the defer list implied; do not treat this defer list as current truth.

---

## Related

- `01-ARCHITECTURE/preservation.md`
- `02-PATTERNS/frontend.md`, `batch-editors.md`
