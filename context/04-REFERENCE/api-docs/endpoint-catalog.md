# API endpoint catalog

**Context note (2025-01-04, revised periodically; e.g. beta removal 2025-11-12):** How internal vs public routes are used and documented. **Maintenance:** When adding or changing public or internal API routes, update this file so it stays aligned with the OpenAPI or code.

**Related:** `01-ARCHITECTURE/system-overview.md`, `app/archive/urls.py`, `app/api/`, `app/internal_api/`, `app/archive/spectacular_hooks.py` (exclude internal from public docs).

---

## Classification principles

### Public API (`api_class_001`)

- Serves **external consumers** and a separate public website.
- **Documented** (OpenAPI / Swagger / ReDoc), **versioned** URLs (e.g. `/api/v1/...`).
- **Read-focused** for external consumers; write scope historically designed but MVP is read-oriented.
- **Authentication:** OAuth2 bearer token; permission class such as `IsAdminOrHasToken` on versioned resources. Map endpoint may use `AllowAny` (verify code).

### Internal / staff API (`api_class_002`)

- Serves **React SPA** and legacy **template** workflows.
- **Session authentication** (cookies) for staff.
- **Not** consumer-facing documentation—excluded from public schema via preprocessing (e.g. paths under `/internal/`).

---

## Public API resources (summary)

| Resource | Paths (typical) | Methods | ViewSet | Permission (typical) | Serializers (typical) |
|----------|-----------------|---------|---------|----------------------|------------------------|
| Items | `/api/v1/items/` | GET | ItemViewSet | IsAdminOrHasToken | ItemListSerializer, ItemDetailSerializer |
| Collections | `/api/v1/collections/` | GET | CollectionViewSet | IsAdminOrHasToken | CollectionList, CollectionDetail |
| Languoids | `/api/v1/languoids/` | GET | LanguoidViewSet | IsAdminOrHasToken | LanguoidList, LanguoidDetail |
| Collaborators | `/api/v1/collaborators/` | GET | CollaboratorViewSet | IsAdminOrHasToken | CollaboratorList, CollaboratorDetail |
| Map | `/api/v1/map/items/` | GET | ItemMapViewSet | AllowAny | ItemMapSerializer, ItemMapFeatureCollectionSerializer |

**Map endpoint notes (earlier 2025 pass; refresh as the API changes):**

- GeoJSON FeatureCollection (RFC 7946).
- Required query: `bbox` (west,south,east,north).
- Optional: `zoom` (0–20), `collection` (abbreviation).
- Filter backends: BoundingBox, Density, Collection (see `02-PATTERNS/backend.md`).
- Title: ItemTitle with `default=True`, fallback `catalog_number`.
- Query optimization: `select_related('collection')`, `prefetch_related('title_item')`.
- Coverage snapshot (point-in-time in this file): ~2,307 items with coordinates (~52.5% of archive)—refresh if needed.

**Documentation URLs (versioning):**

- Latest: `/api/schema/`, `/api/docs/`, `/api/redoc/`
- v1-specific: `/api/v1/schema/`, `/api/v1/docs/`, `/api/v1/redoc/`

**Beta paths:** An earlier draft of this catalog listed `/api/beta/v1/...`. **Beta was removed (2025-11-12)** as unused; use stable `/api/v1/...` only.

---

## Internal / duplicate-path endpoints (staff)

These appear in an **earlier classification in this file** and **overlap** public routes—treat as technical debt to audit.

| Path | Methods | Description | View | Notes |
|------|---------|-------------|------|-------|
| `/api/item-update-migrate/<int:pk>/` | PUT, PATCH | Staff item migration updates | ItemUpdateMigrateView | **Temporary:** restricted to specific user—replace with proper group permissions (`active-work.md`) |
| `/api/languoids/` | GET | Internal languoid list (Django template views) | LanguoidListView | **Duplicates** public list surface—consolidation TBD |
| `/metadata/api/items/<int:item_id>/files/` | POST, PUT | Item file updates for template flows | api_update_item_files | Under `metadata` app URLs |

**Auth:** Django session for staff; exact permission classes per view in code.

---

## Authentication patterns (template and API reference)

- **Public API:** OAuth2 token, `TokenHasScope` / `IsAdminOrHasToken`, read scope as configured.
- **Templates / staff:** `@login_required`, `@user_passes_test`, `LoginRequiredMixin`, `UserPassesTestMixin`.

---

## OpenAPI / documentation strategy

- **Generator:** drf-spectacular (OpenAPI 3).
- **Public only:** `PREPROCESSING_HOOKS` exclude internal API (e.g. `exclude_internal_api` in `app/archive/spectacular_hooks.py`); excluded paths typically `/internal/...`.
- **Tags:** Organize by resource (items, collections, languoids, collaborators, map)—not by version folder name.
- **Consumer guide (repo):** `docs/api/map-endpoint-guide.md` for map integration examples.

---

## Known gaps (from earlier 2025 audit; update as routes change)

- **Duplicate languoid surfaces:** `/api/languoids/` vs `/api/v1/languoids/`—audit and consolidate.
- **Migrate view permissions:** Replace temporary user-specific checks with Archivist/group checks.

---

## Template HTML endpoints

Django’s historical URL roots were `/catalog/`, `/collections/`, etc. **Current production** mounts these under **`/django/...`** (see `preservation.md` and `system-overview.md`). Do not document them as public API—they are staff template fallbacks.
