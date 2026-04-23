# Architectural decisions (snapshot)

**Context note (2025-01-04, map decisions 2025-11-12, revised periodically):** Point-in-time architecture decisions. **Current operational detail:** `infrastructure.md`, `system-overview.md`, `security.md`, `data-models.md`.

---

## API and visibility

- **arch_dec_001:** Evolution from templates + ad-hoc JSON to structured **public DRF API**.
- **arch_dec_002:** Keep **internal** staff endpoints separate from **public** documented API (classification in `endpoint-catalog.md`).

## Deployment

- **arch_dec_003:** **Dual server** public (internet) + private (internal).
- **arch_dec_004:** **Monorepo** despite dual complexity—single customer deploy story.

## Data flow and storage

- **arch_dec_005:** Private ingests from public directionally; private authoritative; public subset published back.
- **arch_dec_008–010:** **Seven-volume** style pipeline; descriptive volume names (quarantine → scan → ingest → main/public); files organized `{storage}/files/{collection_abbr}/{catalog_number}/` with parallel metadata JSON layout.

## Database sync (design intent)

- **arch_dec_011–016:** Checksum-based change detection; event-driven batched sync; incremental exports; **private wins** conflicts; retry/rollback; dedicated **sync_data** volume.

## Virus scanning and transfer

- **arch_dec_017:** Multi-stage quarantine / scan points.
- **arch_dec_018:** **Private pulls** from public scan output (private initiates copy; public does not reach private).

## Temp storage

- **arch_dec_019:** `temp_storage` for archivist sharing foundation + cleanup even if UX incomplete.

## Security / permissions

- **arch_dec_020:** Strict **Django Groups** (Archivist, Museum Staff, Read-Only); mandatory group for non-superusers; implementation in `internal_api` permission class and `permissions.ts` (see `security.md`).

## Philosophy

- **arch_dec_006:** Prefer shared codebase; mode differences mostly scripts/sync.
- **arch_dec_007:** Evolutionary architecture—strategic refactors with preservation constraints.

## Map / GeoJSON (2025-11-12)

- **arch_dec_021:** **Client-side** clustering (markercluster / supercluster), not server-side clusters.
- **arch_dec_022:** **Custom GeoJSON** serializers—no GDAL/PostGIS for simple Points; `[lng, lat]` order.
- **arch_dec_023:** Geographic filters as **DRF FilterBackends** (bbox, density, collection).
- **arch_dec_024:** **Flatten** primary coordinates onto **Item** (migration 0103); Geographic model secondary for advanced cases (confirm current schema in code).
