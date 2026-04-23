# Technical debt registry (historical)

**Context note (2025-11-13, revised periodically):** Log of known debt and a few **resolved** items. **Act on current priorities** via `00-ESSENTIAL/active-work.md` as well.

**Active / current priorities:** See `00-ESSENTIAL/active-work.md`. This file preserves **resolved** entries and **archived framing** for incomplete items so the old JSON can be removed.

---

## Legacy components

### debt_001 — Invenio (active legacy)

- **Content:** Invenio-related code exists in the repository but is **legacy/inactive**. Do not build new features on it. Removal blocked by unknown dependencies or customer constraints (per original note).
- **Mitigation:** Ignore for new development; treat as archaeological code paths.

---

## Resolved debt

### debt_resolved_001 — Django upgrade (2025-01-04)

- Django **3.2 → 5.0.14** completed; breaking changes handled (e.g. django-video-encoding removal, Celery setup, FileInput compatibility, migration imports).

### debt_resolved_002 — Batch editor persistence (2025-11-13)

- Fixed: rows disappearing on refresh, resorting, wrong warning dialogs, missing empty mode.
- **Patterns:** sessionIds ref, order-preserving refresh, three-mode config, warning logic, cell editor pagination.

### debt_resolved_003 — Collaborator filters vs DialectInstance (2025-11-13)

- Replaced deprecated `collaborator_*_dialectinstances` filters with `native_languages__isnull` / `other_languages__isnull` style filters.

### debt_resolved_004 — Import false positives (2025-11-13)

- Fixed: `??` vs `||` for defaults, complete `fieldTypeMap`, case-insensitive text comparison for change detection.

---

## Incomplete / sequencing (verify against active-work)

Legacy JSON listed the following; **status may have evolved**—confirm in code and `active-work.md`:

| decision_id | Topic | Legacy note |
|-------------|-------|-------------|
| debt_002 | Virus scanning | Ready but sequenced; commented in deploy |
| debt_003 | Document→File transition | Strategic migration |
| debt_003 (dup id) | Dual-deployment data sync | rsync, volumes, bidirectional flow |
| debt_004 | Mode-specific organization | SERVER_ROLE, feature flags |
| debt_004 | Endpoint classification | Internal vs public docs exposure |

---

## Architectural inconsistencies (known from 2025-11-13 snapshot; re-verify in code and `endpoint-catalog.md`)

- **Endpoint classification:** Internal vs public listing; duplicate languoid paths—see `04-REFERENCE/api-docs/endpoint-catalog.md`.
