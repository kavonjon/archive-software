# Decision genealogy (historical narrative)

**Context note (2025-01-04, revised occasionally):** Why major choices exist. **For current “must do this” rules**, use the numbered architecture and `02-PATTERNS` files, not this archive alone.

---

## API evolution

- **genealogy_001 (deprecated):** Started as Django templates with ad-hoc JSON/DRF for internal fetching.
- **genealogy_002 (active):** Mid-project need for a **public-facing API** drove structured DRF endpoints and a split between **internal** staff consumption and **versioned public** API.

## Deployment evolution

- **genealogy_003 (deprecated):** Originally single-server assumption.
- **genealogy_004 (active):** Pivot to **dual deployment** (public + private) for security and workflow separation while keeping customer operations simple.

## Code organization

- **genealogy_005 (active):** **Monorepo** retained despite dual-mode complexity so one codebase deploys twice with environment differences rather than two repos.

---

## Related

- `01-ARCHITECTURE/infrastructure.md`, `system-overview.md`
- `05-ARCHIVE/refactoring-roadmap-snapshot.md`
