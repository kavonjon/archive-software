# Where pattern topics live in this tree

**Index triad (keep in sync):** When you add pattern rows here, ensure new **top-level docs** appear in **`00-ESSENTIAL/context-map.md`** and entry points in **`00-ESSENTIAL/system-inventory.md`** if readers need them. See **README.md → Maintenance → Index triad**.

**Purpose:** Single map from **topic** to **which Project Context file** documents it, so you add or look up material in the right place.

**Add new material here (not a parallel source tree):**

| Topic area | Location |
|------------|----------|
| Accessibility, TypeScript, MUI, responsive layout, form/table utilities | `02-PATTERNS/frontend.md`, `02-PATTERNS/accessibility.md` |
| List pages (filters, debounce, column visibility, layout) | `04-REFERENCE/frontend/list-page-patterns.md` (stub in `02-PATTERNS/frontend.md`) |
| Django, DRF, Celery, signals, validation, map FilterBackends | `02-PATTERNS/backend.md` |
| Batch editors, import/export, Redis, grid cells | `02-PATTERNS/batch-editors.md` |
| GeoJSON, public map API, map filters, clustering notes | `01-ARCHITECTURE/system-overview.md`, `02-PATTERNS/backend.md`, `05-ARCHIVE/architectural-decisions-snapshot.md` |
| Collaborator model (names, M2M languages, harmonization narrative, dialect removal) | `01-ARCHITECTURE/data-models.md`, `05-ARCHIVE/collaborator-harmonization-snapshot.md`, `05-ARCHIVE/deprecated.md` |
| Languoid list (client load-all, tree pagination—**languoid-only**) | `04-REFERENCE/frontend/languoid-list-implementation.md`, `04-REFERENCE/frontend/list-page-patterns.md` (exception warning) |
| Geographic / Leaflet / coordinates UI | `02-PATTERNS/frontend.md`, `04-REFERENCE/frontend/geographic-features.md` |

**If a topic is hard to find:** search under `context/` (e.g. `BoundingBox`, `GeoJSON`, `axe-core`) and, when behavior is in code, the application codebase for the same terms.

**Last updated:** 2026-05-24 (revise whenever the index triad or pattern layout changes)
