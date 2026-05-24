# Infrastructure & Deployment

**Last Updated**: 2026-03-14

## Dual-Server Architecture

**Purpose**: Separate culturally sensitive materials from public-accessible materials while enabling both internal workflows and public API access.

**Primary Driver**: Cultural sensitivity requirements (see `cultural-context.md`)

**Architecture**:
- **Private Server**: Behind firewall, internal IP only, full archive access, can reach public server
- **Public Server**: Internet-facing, access level 1 materials only, receives uploads, hosts public API

**Data Flow**:
1. Public server receives uploads
2. Private server copies scanned files from public
3. Private server processes and stores in main repository
4. Private server publishes curated subset back to public

**Network Security**: Unidirectional access - private can reach public via SSH, public cannot reach private

---

## Storage Volume Architecture (7 Volumes)

### Public Server Volumes

**upload_quarantine** (sequestered_incoming):
- Purpose: Initial file upload quarantine
- Pipeline: Step 1 - Upload destination
- Access: Write (uploads), Read (virus scanner)
- Cleanup: Files moved to scan_output after scanning

**scan_output** (sequestered_outgoing):
- Purpose: Virus scanner output staging
- Pipeline: Step 2 - Post-scan staging
- Access: Write (virus scanner), Read (private server copy process)
- Cleanup: Files removed after private server copies

**public_storage**:
- Purpose: Final destination for publicly accessible files
- Pipeline: Step 5 - Curated content from private server
- Organization: `/files/{collection_abbr}/{catalog_number}/`
- Access: Write (private publish), Read (nginx, public API)
- Cleanup: Managed by private server publishing

**temp_storage**:
- Purpose: Temporary file sharing (archivist-controlled)
- Pipeline: Step 6 - Temporary access (Beyond MVP)
- Access: Write (private server future), Read (nginx temporary)
- Cleanup: Files >24 hours removed every 6 hours (Celery)
- MVP Status: Volume + cleanup exist, push mechanism beyond MVP

**sync_data**:
- Purpose: Database synchronization exchange
- Pipeline: Step 6 - Incremental JSON exports
- Access: Write (private export), Read (public import)
- Format: Timestamped JSON files
- Cleanup: Remove after import success, keep failed for debug

### Private Server Volumes

**ingest_queue** (sequestered_incoming):
- Purpose: Pre-ingestion quarantine on private
- Pipeline: Step 3 - Receives copies from public scan_output
- Access: Write (cross-server copy), Read (ingestion, virus scanner)
- Cleanup: Files moved to main_storage after ingestion

**main_storage**:
- Purpose: Complete file repository with full archive
- Pipeline: Step 4 - Final permanent storage
- Organization: `/files/{collection_abbr}/{catalog_number}/` and `/metadata/{collection_abbr}/{catalog_number}/`
- Access: Write (ingestion), Read (staff, publishing)
- Source for publishing to public server

---

## File Processing Pipeline (8 Steps)

**Step 1: Upload to Public**
- Location: upload_quarantine (public)
- Action: Files uploaded land in quarantine

**Step 2: Public Virus Scan**
- Location: upload_quarantine to scan_output (public)
- Action: Scanner processes, clean files move to scan_output

**Step 3: Cross-Server Copy**
- Location: scan_output (public) to ingest_queue (private)
- Action: Private server copies files via SSH/rsync

**Step 4: Private Ingestion**
- Location: ingest_queue to main_storage (private)
- Action: Private processes to permanent storage

**Step 5: Private Publishing**
- Location: main_storage (private) to public_storage + sync_data (public)
- Action: Curated subset pushed back to public

**Step 6: Public Database Sync**
- Location: sync_data (public) to Public database
- Action: Process incremental database updates

**Step 7: Temporary Sharing** (Beyond MVP)
- Location: main_storage (private) to temp_storage (public)
- Action: Select files for temporary public access

**Step 8: Automatic Cleanup**
- Location: temp_storage (public)
- Action: Remove files >24 hours old

---

## Database Synchronization

**Approach**: Event-driven, checksum-based, incremental

### Sync Process (4 Steps)

**1. Change Detection (Private)**:
- Model saves trigger Django signals
- Queue sync task
- Calculate checksum for changed records
- Compare with stored checksums

**2. Export Generation (Private)**:
- Celery task collects changed records since last sync
- Generate incremental JSON export
- Write timestamped files to sync_data volume

**3. Import Processing (Public)**:
- Monitor sync_data volume
- Process files chronologically
- Checksum comparison
- Retry logic (3 attempts with exponential backoff)
- Transaction-based rollback on failure

**4. Cleanup**:
- Remove processed files after success
- Keep failed files for debugging
- Detailed operation logging

### Sync Policies

**Conflict Resolution**: Private server always wins (no conflict detection needed)

**Field Filtering**: Sensitive fields excluded during export to public

**Rationale**: Private server is authoritative source; public server is read-only recipient of curated subset

---

## Virus Scanning Architecture

**Defense in Depth**: Multi-stage scanning

### Public Server Scanner

- Reads: upload_quarantine
- Writes: scan_output
- Interval: Every 5 minutes
- Purpose: Initial scan before cross-server transfer

### Private Server Scanner

- Reads: ingest_queue
- Writes: main_storage
- Interval: Every 5 minutes
- Purpose: Final scan before permanent storage

**MVP Status**: Architecture defined, currently commented out for deployment simplicity

**Rationale**: Multi-stage scanning provides defense in depth - files scanned before cross-server transfer and again before final storage

---

## Production Deployment (TrueNAS Scale)

**Platform**: TrueNAS Scale 25

**Deployment Method**: Custom App via Apps UI with docker-compose.private.yml

**Container Naming**: TrueNAS prefixes with `ix-archive-software_` (e.g., `ix-archive-software_postgres_django_private_1`)

**Management**: App lifecycle through TrueNAS Scale Apps UI (not direct docker-compose commands)

**PostgreSQL image**: Pinned to `postgres:17` in all compose files. Never use unpinned `postgres` or `postgres:latest`. Docker Hub `latest` moved to PG 18+ (Sep 2025); PG 18+ uses a different data directory layout incompatible with existing volumes at `/var/lib/postgresql/data/`. Major upgrades require explicit `pg_upgrade` — see `docs/deployment/database-operations.md`.

### Update Scripts

**deploy-update-private.sh**:
- Purpose: Update application code without disrupting data
- Process: Build images locally, tag with ix- prefix, restart via TrueNAS UI
- Update types:
  - `web`: Code changes only (Django, templates, business logic)
  - `all`: Infrastructure changes (Dockerfile, nginx, Celery, dependencies)
- Workflow: Pull git updates - Build containers - Tag for TrueNAS - Stop/Start via UI

**deploy-restore-db-private.sh**:
- Purpose: Restore database dump to running production database
- Default: backup/initial_restore.sql
- Features: Auto container discovery, safety backup, file age warning, transaction-based restore, Django restart + migrations
- Usage: `./deploy-restore-db-private.sh [dump_file.sql]`

### Database Backups

**Automated Backups**:
- Schedule: Daily at 3:00 AM via Celery Beat
- Location: backup/dumps/
- Retention: 30 days daily, 6 months weekly, 2 years monthly

**Manual Backups**: Use deploy-restore-db-private.sh

### Current Status

**System deployed in production on private server with real data.**

**Critical Constraint**: All changes MUST be backward compatible. No breaking changes allowed.

---

## Server Roles (Environment Variable)

**SERVER_ROLE** determines behavior:
- `public` (default): Public-facing server with virus scanning, restricted uploads
- `private`: Internal-only server with full features

**Note**: Default is `'public'` per `os.environ.get('SERVER_ROLE', 'public')` in `settings.py`. The private server deployment sets `SERVER_ROLE=private` explicitly in its docker-compose configuration.

### Private-Server-Only Environment Variables

These environment variables are set in the private server's docker-compose configuration and have no effect on the public server:

| Variable | Purpose |
|----------|---------|
| `SERVER_ROLE` | Set to `private` on the private server |
| `PUBLIC_SERVER_URL` | URL of the public server (used by private server for cross-server operations) |
| `PUBLIC_REDIS_URL` | Redis URL on the public server (used by private server for writing to public server's Redis) |

`PUBLIC_SERVER_URL` and `PUBLIC_REDIS_URL` are read in `settings.py`:
```python
PUBLIC_SERVER_URL = os.environ.get('PUBLIC_SERVER_URL', '')
```
Both default to empty string — absence means cross-server features are inactive (dev mode).

### Dual Deployment Pattern

**Single Codebase**:
- Same repository supports both roles
- Conditional logic in `settings.py`, `file_utils.py`, `tasks.py`

### Celery Queue Routing by Server Role

`dev.sh` sets different Celery queue assignments depending on `SERVER_ROLE`:

| Queue | Private Server | Public Server |
|-------|---------------|---------------|
| `private` | Active | Not running |
| `public` | Not running | Active |
| `common` | Active | Active |

**Mode-Specific Tasks** (route to server-role queues):
- `process_scanned_files` — public queue only
- `cleanup_temp_files` — public queue only (purges temp_storage every 6 hours)
- `sync_public_files` — private queue only

**Common Tasks** (run on both servers):
- Cache warming, exports, hierarchy updates

**Note**: `Collection.save()` in `models.py` contains a SERVER_ROLE conditional branch (~line 563 private) that adjusts behavior based on deployment context.

### TrueNAS Production Build

**React build requires** `PUBLIC_URL=/static/frontend` for TrueNAS production deployment. Without this, static assets are served from the wrong path and the app fails to load.

```bash
# Production build for TrueNAS
PUBLIC_URL=/static/frontend npm run build
```

**Operational Status**:
- Database sync operational
- File publishing operational
- Volume-based data exchange (no direct API calls between servers)

**Deployment Simplicity**: Customer deploys same codebase to both servers with different environment configurations

---

## Architectural Evolution

### Historical Decisions

**Django to DRF Transition**:
- Evolved from Django templates with patchwork JSON endpoints to structured DRF API
- Mid-development change driven by customer requirement for public API access
- Created dual endpoint ecosystem (internal + public API)

**Dual-Server Architecture**:
- Mid-development decision to implement public (internet-facing) and private (firewall-protected) servers
- Requirements changed to need both public access and secure internal processing
- Maintains deployment simplicity via monorepo with SERVER_ROLE environment variable

**Monorepo Maintenance**:
- Single repository despite dual-deployment complexity
- Customer deploys same codebase to both servers with different environment configurations
- Preserves deployment simplicity over repository separation

**Seven-Volume Storage Design**:
- Multi-stage file processing pipeline requires clear separation of concerns
- Descriptive volume names clarify purpose: upload_quarantine to scan_output to ingest_queue to main_storage
- Original "sequestered_incoming" on both servers created confusion

**Checksum-Based Database Sync**:
- More reliable than timestamp-based sync
- Handles clock drift and ensures data integrity
- Event-driven with batching within time windows for efficiency
- Incremental exports (only changed records) for performance

**Private Server Wins**:
- Private server always authoritative (no conflict detection needed)
- Public server is read-only recipient of curated subset
- Simplified conflict resolution

**Multi-Stage Virus Scanning**:
- Defense in depth approach with scanning at multiple pipeline points
- Public server scan before cross-server transfer
- Private server scan before final storage
- Architecture defined, currently commented out for deployment simplicity

**Cross-Server File Transfer**:
- Private server actively copies files from public server (pull model)
- Maintains security isolation - private can reach public but not vice versa
- Private server controls when and what files to ingest

**Temporary Storage Infrastructure**:
- temp_storage volume and automated cleanup exist in MVP
- Push mechanism for archivist-controlled sharing is beyond MVP
- Foundation built for future selective sharing feature

**Geographic Data Flattening** (2025-11-12):
- Moved latitude/longitude from separate Geographic model to Item model
- 1:1 relationship didn't justify separate model
- Migration 0103 added DecimalFields (22 digits, 16 decimal places)
- 2,307 items with coordinates (52.5% coverage)

**Custom GeoJSON Serializer** (2025-11-12):
- Avoided GDAL/PostGIS dependencies for simpler deployment
- RFC 7946 compliant without heavy system dependencies
- Sufficient for current scale (2,307 mappable items)

**Client-Side Map Clustering** (2025-11-12):
- API delivers data efficiently, clients handle visualization
- Standard libraries exist (Leaflet.markercluster, MapBox Supercluster)
- Better separation of concerns and flexibility per application

**Database-Level Geographic Filtering** (2025-11-12):
- Implemented as DRF FilterBackend components (BoundingBoxFilterBackend, DensityFilterBackend, CollectionFilterBackend)
- Database-level filtering prevents loading unnecessary data
- Composable and reusable across endpoints

---

**See also**:
- `cultural-context.md` - Cultural requirements driving architecture
- `system-overview.md` - Tech stack and application architecture
- `security.md` - Permission groups and access control
- `../00-ESSENTIAL/active-work.md` - Production status and MVP priorities
