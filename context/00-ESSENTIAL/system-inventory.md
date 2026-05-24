# Project Context System: inventory and coverage

**Last updated:** 2026-05-24

**Index triad (keep in sync):** When you change notable files in this tree, update **`context-map.md`** (topic → path) and **`05-ARCHIVE/where-patterns-live.md`** (pattern routing) in the same pass. See **README.md → Maintenance → Index triad**.

This file is a **self-contained** map of what lives in `context/` and what you can expect to find here. The **authoritative** protocol and update rules are in `README.md`.

---

## What this tree is

A single Markdown project context: **constraints**, **patterns**, **lessons learned**, and **archived snapshots** (debt, planning, migrations of obsolete code). It does not replace the code or `docs/` user documentation; it complements them.

---

## Layout (folders)

| Folder | Role |
|--------|------|
| `00-ESSENTIAL` | Onboarding, current work, this inventory, `context-map` |
| `01-ARCHITECTURE` | System shape, models, security, culture, product intent |
| `02-PATTERNS` | Reusable implementation standards (frontend, backend, batch, a11y) |
| `03-LESSONS` | Feature-specific deep references (e.g. batch editors, MultiSelect) |
| `04-REFERENCE` | Stage plans, API catalog, `docs/` map, dependencies, mode-specific deploy notes |
| `05-ARCHIVE` | Historical snapshots, deprecated patterns, pattern-topic index (`where-patterns-live.md`), read-only decision debris |

**Root in this tree:** `README.md` (navigation, agent protocol, maintenance).

---

## Major files (by concern)

- **Sprint and production truth:** `active-work.md`
- **Must not break (refactors):** `01-ARCHITECTURE/preservation.md`
- **Stack, APIs, Redis, signals overview:** `01-ARCHITECTURE/system-overview.md`
- **Deploy, volumes, `SERVER_ROLE`:** `01-ARCHITECTURE/infrastructure.md` and `04-REFERENCE/deployment/mode-specific-code.md`
- **Entities and fields:** `01-ARCHITECTURE/data-models.md`
- **Collaborator harmonization (narrative):** `05-ARCHIVE/collaborator-harmonization-snapshot.md` (with `data-models.md`, `deprecated.md`)
- **Groups and permissions:** `01-ARCHITECTURE/security.md`
- **Public vs internal API listing:** `04-REFERENCE/api-docs/endpoint-catalog.md`
- **Batch editing:** `02-PATTERNS/batch-editors.md` + `03-LESSONS/item-batch-editor.md` (primary reference)
- **List page UX (filters, columns):** `04-REFERENCE/frontend/list-page-patterns.md`
- **Detail forms / pickers:** `04-REFERENCE/frontend/form-patterns.md`
- **React conventions:** `04-REFERENCE/frontend/react-conventions.md`
- **App shell (auth, footer):** `04-REFERENCE/frontend/app-shell-patterns.md`
- **Topic → file index:** `context-map.md`
- **Pattern topic routing (where to add new notes):** `05-ARCHIVE/where-patterns-live.md`

---

## Coverage (self-check)

These are **forward** checks only—this tree is the project context, not a diff against any prior format.

| Question | Where to get to “yes” |
|----------|------------------------|
| Debug list page filters / column visibility? | `04-REFERENCE/frontend/list-page-patterns.md` |
| In-place edit or picker dropdown? | `04-REFERENCE/frontend/form-patterns.md` |
| Implement a new batch editor? | `03-LESSONS/item-batch-editor.md`, `batch-editors.md`, `data-models.md` |
| Debug cache / Celery / filters in batch? | `item-batch-editor.md`, `batch-editors.md`, `system-overview.md`, `backend.md` |
| Security model (groups, DRF, React)? | `security.md` |
| Stage roadmap (Stage 2+)? | `04-REFERENCE/stage-plans/stages-overview.md` |

---

## Suggested first reads

1. `README.md` (structure and protocol)  
2. `quickstart.md`  
3. `active-work.md`  
4. Branch by task using `context-map.md`

---

## Where to add new knowledge

Follow **README.md** (“Updating the Project Context System”): default updates go to `active-work.md` and the smallest relevant pattern or architecture file; large stable topics may get `04-REFERENCE/` files with user approval.
