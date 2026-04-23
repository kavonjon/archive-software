# Stage 5: LTO backup system (outline)

**Context note (2025-01-04, revised if plans change):** LTO and long-horizon backup—**not implemented**; planning-only. **Prerequisites (conceptual):** Stage 2 (repository) and Stage 4 (misc improvements) in `stages-overview.md` and related stage files.

---

## Strategic goal (stage5_001)

Long-term preservation backup to university **LTO tape** with **encyclopedia-style** collection groupings and compression management. **Complexity:** high (dynamic grouping, size estimation, hybrid human/automation).

## University constraints (stage5_002)

- Submission targets **>1TB** per backup artifact (stated product requirement; verify before implementation).
- Compression before handoff; **manual** final step for actual tape write (external to this app).

## Encyclopedia grouping (stage5_003–004)

- Group collections so each export meets size policy; alphabetical banding is one example approach.
- **Size estimation** for compressed outputs; split/merge groups as collections grow.
- **Change detection:** track whether a grouping’s source data changed since last generation; timestamps; archivist-facing status (e.g. ~3-month check cadence—set at implementation time).

## Workflow (stage5_005)

- Archivist-triggered generation; background compression (Celery); temp volume; rsync to external staging; manual completion; **cleanup** of generated files after ~2 weeks (planning target).

## Storage (stage5_006)

- Dedicated private-server volume for temporary compressed artifacts; read pattern for archivist verification.

## Metadata tracking (stage5_007)

- JSON and/or PostgreSQL fields for grouping definitions, timestamps, estimates, history. **Not** tracking physical tape placement (external).

## UI (stage5_008)

- Dashboard: grouping status, changed groupings, trigger generation, monitor compression, initiate rsync, history. Archivist/admin only; integrate with main React app.

## Technical TBD (stage5_009–012)

- Compression algorithm choice, estimation accuracy, error/retry, performance testing with university IT.

---

## Related

- `stage-2-5.md`, `stages-overview.md`
- `01-ARCHITECTURE/infrastructure.md`
