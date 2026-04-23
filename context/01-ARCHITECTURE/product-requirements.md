# Product requirements (core)

**Context note (2025-01-04, revised periodically):** PM-level mission, scope, and repository direction. **Roles and live API behavior:** `security.md` and `user-workflows.md` when wording must match product reality.

---

## Mission (core_purpose_001)

**NAL Archive** — digital repository for **cultural and linguistic heritage**, Sam Noble Oklahoma Museum of Natural History, University of Oklahoma. Mission: support Native communities and researchers in **language revitalization** and **cultural preservation**.

## System shape (core_system_arch_001)

Django archive with rich metadata: Items, Files, Collections, Collaborators, Languoids. **File** model supersedes legacy **Document** for true ingestion over time.

## Repository direction (repo_mgmt_001)

Move from metadata-only to **full file content** management, **analogous to InvenioRDM but simplified** for this institution—must store **actual content**, not only pointers.

## Deployment (deploy_arch_001–002)

- **Dual deployment:** private (full files + metadata) + public (subset + sanitized metadata); automated push of curated content private → public.
- **Monorepo + `SERVER_ROLE`:** same codebase, different env and compose (see `infrastructure.md`).

## Public API intent (api_access_001, api_req_001–002)

- Target: **OAI-PMH** open harvesting + **privileged API key** tier for trusted apps (see `system-overview.md` for implementation state).
- **Internal** endpoints must not be advertised as public consumer API (`endpoint-catalog.md`).

## Content types (content_types_001)

Diverse materials: AV (ceremonial, music, interviews, narratives), publications, manuscripts, images, 3D, ephemera, educational, ethnographic, stories, prayers, cultural practices.

## Data entities (data_entities_001)

Items, Collections, Collaborators (incl. anonymous), Languages/Languoids, Documents/Files.

## Legacy Invenio (legacy_001)

**Invenio-related code is legacy/inactive** — do not extend; removal blocked pending broader cleanup (see `technical-debt-history.md`).

## Staging model

Five-stage roadmap: `04-REFERENCE/stage-plans/stages-overview.md` (Stage 0 React, Stage 1 batch editing, and later stages).

---

## Related

- `cultural-context.md`, `data-models.md`, `preservation.md`
