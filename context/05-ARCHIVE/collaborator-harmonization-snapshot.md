# Collaborator harmonization (2025-11-08 snapshot)

**Context note (2025-11-08, revised if schema changes):** Collaborator name harmonization and Dialect removal. **Current schema:** `data-models.md` and `05-ARCHIVE/deprecated.md`. This file holds **narrative** the short model sections do not.

---

## Scope (collab_001)

- Name field restructuring + **signal-based** derived fields
- **Decommission Dialect / DialectInstance**; direct **Languoid** M2M
- Frontend updates to Collaborator list/detail
- Default Django M2M through tables instead of custom through models

## Name fields (collab_002)

- Components: `first_names`, `nickname`, `last_names`, `name_suffix`, `other_names` (ArrayField).
- **`full_name`:** computed in **`pre_save`** (`compute_collaborator_derived_fields` in `app/metadata/signals.py`) — format like `first_names "nickname" last_names suffix`, omit empties, trim spaces.
- Also standardizes birth/death date strings, generates slug (base58), warns on anonymous toggle if referenced.
- **UI:** `full_name` read-only; helper text explains computation.

## Display name variants (frontend)

- Multiple citation formats (full, sorted by last, first+last, etc.); **Anonymous** shows `Anonymous {id}`.

## Dialect removal (collab_003)

- Rationale: Languoid hierarchy covers dialects; custom through required `modified_by` and complicated M2M.
- Collaborator `native_languages` / `other_languages` and Item/Document language M2M now use **default through** tables.

## Additional topics in source JSON

- Import/export path updates, batch editor column changes, filter migrations, testing notes—if needed, **grep the codebase**; this snapshot captures the **core architectural** outcomes only.
