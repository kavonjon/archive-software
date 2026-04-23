# Refactoring roadmap (snapshot)

**Context note (2025-01-04, revised occasionally):** Point-in-time refactor readiness. **Current execution order** may differ; reconcile with `00-ESSENTIAL/active-work.md` and `04-REFERENCE/stage-plans/`.

---

## refactor_001 — API authentication simplification

- **Idea:** Move from heavy OAuth2-for-everything toward **two-tier** read API: OAI-PMH (open harvesting) + **API key** for privileged consumers.
- **Readiness (in this snapshot):** ready_for_development / planned.
- **Implementation sketch (in this snapshot):** OAI-PMH serializer, `HasValidAPIKey`, rate limits, APIKey model, backward compatibility during transition.

## refactor_002 — Dual-deployment completion

- **Idea:** Finish data sync, mode-specific features, bash/rsync automation.
- **Readiness (in this snapshot):** in_progress / high priority.

## refactor_003 — General refactoring strategy

- **Idea:** Evolutionary codebase needs **strategic** refactors; balance modernization vs `preservation.md` constraints.
- **Readiness (in this snapshot):** ongoing / needs_planning.

---

## Related

- `04-REFERENCE/stage-plans/stage-2-5.md`, `stages-overview.md`
- `04-REFERENCE/api-docs/endpoint-catalog.md`
