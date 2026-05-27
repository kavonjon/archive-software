# Repository documentation layout (`docs/`)

**Context note (2025-11-10, revised periodically):** Map of the repository `docs/` tree. **This folder (`context/`)** is the Project Context System; repository **`docs/`** is separate user, operator, and developer documentation in the repo.

---

## Philosophy (docs_001)

Organize by **audience**: operators, developers, end users; co-locate READMEs with code where helpful.

## Directory tiers (docs_002)

| Path | Audience | Typical content |
|------|----------|-----------------|
| `docs/README.md` | All | Index, quick links, stack summary |
| `docs/deployment/` | Admins | Deploy, DB backup/restore TrueNAS, URL routing |
| `docs/development/` | Contributors | Env setup, dependencies |
| `docs/operations/` | Operators | Day-to-day, troubleshooting |
| `docs/user-guide/` | Museum staff | End-user docs (PM-triggered authoring); copied into frontend static on build |
| `docs/system-behavior/` | Technical | Algorithms, workflows |

## User guide inventory (`docs/user-guide/`)

In-app help at `/user-guide`. Build/copy: `frontend/package.json` (`prestart`, `prebuild`, `copy-to-django`); see `04-REFERENCE/frontend/app-shell-patterns.md`.

| File | Topic |
|------|-------|
| `getting-started.md` | Navigation, list browsing, workflow |
| `editing-languoids.md` | Single-record languoid fields and editing |
| `editing-collaborators.md` | Single-record collaborator fields and editing |
| `editing-items.md` | Items list, detail fields, create/delete (2026-05-26) |
| `batch-editor/overview.md` | Shared batch editor UX |
| `batch-editor/languoid-batch.md` | Languoid batch workflows and import columns |
| `batch-editor/collaborator-batch.md` | Collaborator batch workflows and import columns |
| `batch-editor/item-batch.md` | Item batch workflows (~60 columns) (2026-05-26) |
| `batch-editor/importing-data.md` | Generic import intro + languoid-specific reconciliation |
| `batch-editor/importing-data-items.md` | Item import (catalog # match, Collection export-only) (2026-05-26) |
| `batch-editor/keyboard-shortcuts.md` | Batch grid keyboard reference |

When adding user-guide files: update `UserGuidePage.tsx` section list and this table.

## Notable files (curated list)

- `docs/system-behavior/batch-editor/validation.md` — Batch editor validation (live edit, import, save); Mermaid diagrams; Languoid/Collaborator/Item comparison (canonical for maintainers)
- `docs/deployment/database-operations.md` — DB backup/restore on TrueNAS Scale
- `docs/deployment/url-routing.md` — Django + React SPA routing
- `docs/api/map-endpoint-guide.md` — Public map API for integrators (Leaflet/MapBox examples)
- `docs/development/dependencies.md` — Dev prerequisites
- Root `README.md` — project overview; may mention legacy Invenio setup
- `backup/README.md` — automated backup documentation

**Maintenance:** When adding a major doc, update `docs/README.md` index if applicable.
