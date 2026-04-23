# Key third-party dependencies (policy)

**Context note (2025-01-04, revised periodically; map stack notes 2025-11-12):** Policy and categories for dependencies. **Versions:** `Pipfile.lock` and `frontend/package.json` are authoritative; do not treat version numbers in this file as ground truth.

---

## Backend stack

- **Django:** Core web framework; upgrades affect models, auth, admin, templates.
- **Django REST Framework:** Public and internal API serialization, permissions, docs integration.
- **django-cors-headers:** Dev split (e.g. localhost:3000 → 8000) with credentials; not required same-origin production.
- **Celery / Redis:** Async tasks and caching (batch editors, exports).
- **drf-spectacular / oauth2:** OpenAPI and OAuth2 for public API surface.

## Cultural / media processing

- **mutagen, librosa, openpyxl:** Audio/metadata and Excel import/export (see `preservation.md`).

## Frontend map stack

- **leaflet:** BSD-2-Clause; bundler requires explicit icon config (`leafletConfig.ts`).
- **react-leaflet:** Hippocratic License 3.0; peer-depends on `leaflet`; major upgrades need compatibility check.
- **Nominatim (OSM):** Service, not package; ODbL data; include proper User-Agent; respect fair-use / rate limits; debounce search.

## Review triggers (periodic)

- Before major refactors, new integrations, quarterly audit, deployment changes, security patches.

## Dual deployment

- Prefer dependencies that work in both **public** and **private** `SERVER_ROLE` configurations (env-driven paths, queues).
