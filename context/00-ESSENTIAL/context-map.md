# Context system map

**Index triad (keep in sync):** Update **`system-inventory.md`** (coverage / major files) and **`05-ARCHIVE/where-patterns-live.md`** (pattern topics) when you add or rename entries here. See **README.md → Maintenance → Index triad**.

Quick index of all **Project Context System** files in `context/`.

| Topic | Location |
|-------|----------|
| Reading order / protocol | `README.md` |
| Quick orientation | `00-ESSENTIAL/quickstart.md` |
| What lives where (full tree map) | `00-ESSENTIAL/system-inventory.md` |
| Current sprint / priorities | `00-ESSENTIAL/active-work.md` |
| This index | `00-ESSENTIAL/context-map.md` |
| Preservation / must-not-break | `01-ARCHITECTURE/preservation.md` |
| Stack, APIs overview | `01-ARCHITECTURE/system-overview.md` |
| Dual server, storage, Celery | `01-ARCHITECTURE/infrastructure.md` |
| Models, relationships | `01-ARCHITECTURE/data-models.md` |
| Auth / groups | `01-ARCHITECTURE/security.md` |
| Cultural requirements | `01-ARCHITECTURE/cultural-context.md` |
| PM requirements summary | `01-ARCHITECTURE/product-requirements.md` |
| User workflows | `01-ARCHITECTURE/user-workflows.md` |
| Batch editors | `02-PATTERNS/batch-editors.md` |
| Batch editor validation flows | `docs/system-behavior/batch-editor/validation.md` |
| React / TS | `02-PATTERNS/frontend.md` |
| Django / DRF / Celery | `02-PATTERNS/backend.md` |
| Accessibility | `02-PATTERNS/accessibility.md` |
| Item batch lessons | `03-LESSONS/item-batch-editor.md` |
| Collaborator batch lessons | `03-LESSONS/collaborator-batch-editor.md` |
| MultiSelect + ReactGrid | `03-LESSONS/multiselect-cell-reactgrid.md` |
| Stage plans | `04-REFERENCE/stage-plans/` |
| API catalog | `04-REFERENCE/api-docs/endpoint-catalog.md` |
| Languoid list deep dive | `04-REFERENCE/frontend/languoid-list-implementation.md` |
| List page patterns (filters, columns, layout) | `04-REFERENCE/frontend/list-page-patterns.md` |
| Form and picker patterns | `04-REFERENCE/frontend/form-patterns.md` |
| React conventions (hooks, errors, testing) | `04-REFERENCE/frontend/react-conventions.md` |
| App shell (auth, footer, user guide) | `04-REFERENCE/frontend/app-shell-patterns.md` |
| User guide file inventory + build/copy | `04-REFERENCE/docs-directory.md` (User guide inventory) |
| Geographic UI | `04-REFERENCE/frontend/geographic-features.md` |
| Dependencies policy | `04-REFERENCE/dependencies.md` |
| `docs/` repo layout | `04-REFERENCE/docs-directory.md` |
| Mode-specific / SERVER_ROLE | `04-REFERENCE/deployment/mode-specific-code.md` |
| Deprecated models / patterns | `05-ARCHIVE/deprecated.md` |
| Technical debt log | `05-ARCHIVE/technical-debt-history.md` |
| Decision history | `05-ARCHIVE/decision-genealogy.md` |
| Refactoring snapshot | `05-ARCHIVE/refactoring-roadmap-snapshot.md` |
| Django template inventory snapshot | `05-ARCHIVE/django-template-inventory-snapshot.md` |
| Architectural decisions snapshot | `05-ARCHIVE/architectural-decisions-snapshot.md` |
| Collaborator harmonization narrative | `05-ARCHIVE/collaborator-harmonization-snapshot.md` |
| Old upgrade plan | `05-ARCHIVE/dependency-upgrade-plan-historical.md` |
| Login UX note | `05-ARCHIVE/login-homepage-ux-2025-10.md` |
| Topic → which pattern file | `05-ARCHIVE/where-patterns-live.md` |

**Maintenance (human):** Before architecture or API changes, read `preservation.md`, `endpoint-catalog.md`, and `infrastructure.md`; after milestones, update `active-work.md` and the relevant pattern or architecture file; on conflicts, stop and resolve with PM. When adding or renaming Project Context files, refresh the **index triad** (`system-inventory.md`, this file, `where-patterns-live.md`) per `README.md`.
