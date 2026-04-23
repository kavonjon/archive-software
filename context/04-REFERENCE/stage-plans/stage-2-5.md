# Stage 2–5 Technical Planning

Technical decisions captured from planning phase (2025-01-04). These are **intended designs**, not yet implemented.

---

## Stage 2: Repository Management

**Goal**: Transform from metadata catalog to full digital repository. Replace Document model with File model.

**Status**: Planned. Prerequisite: Stage 1 complete.

### Storage Architecture

**Directory structure** (on private server `main_storage`):
```
main_storage/
  files/{collection_handle}/{catalog_number}/[actual_files]
  metadata/{collection_handle}/{catalog_number}/
    {collection_handle}-metadata.json     # collection-level
    {catalog_number}-metadata.json        # item-level
```

Metadata JSON files are auto-generated and contain the full object record for external reference. Original filenames are preserved.

### File Model (replaces Document)

Enhanced capabilities over Document:
- SHA-256 checksum storage and verification
- File integrity status tracking (`healthy`/`failed`/`needs_verification`)
- Processing status tracking (users see pipeline status in UI)
- Works on public server even when actual files are missing (metadata-only mode)
- Same access level system as Item model

Data volume: ~100,000 Document records to migrate. Migration is manual (custom scripts with verification). Document model kept as backup until migration verified successful.

### Upload: tus.io (Resumable)

**Decision**: `tus.io` for resumable uploads (chosen over standard multipart).

**Why**: Files can exceed 1TB. Network interruptions during upload of large audio/video archives are unacceptable. `tus.io` supports seamless resume.

**Implementation**:
- React frontend integrates tus.io client
- Streaming SHA-256 checksum calculation during upload (no full file in memory)
- Real-time upload progress tracking in UI
- Integrated with Stage 1 React frontend

### Processing Pipeline (6 steps, all via Celery)

1. SHA-256 checksum calculation (during upload)
2. Virus scanning
3. Metadata extraction (format, duration, technical specs)
4. Thumbnail generation
5. Video sample creation (first 30 seconds, low quality)
6. Final integrity verification

**Failure handling**:
- Virus scan failure: Retry once, delete file, warn user. Archivists can override with risk warning.
- Thumbnail failure: Log error, continue (non-critical)
- Integrity failure: Mark file for replacement, notify administrators

### Download Architecture

- `StreamingHttpResponse` for large file downloads (never load full file in memory)
- Expiring signed URLs for API consumers
- Download links through both internal and public APIs
- Public server: `download_available: false` with `access_message` when files are restricted

### Integrity Monitoring

- Periodic Celery task verifies checksums against stored values
- Integrity status is private metadata (archivist/admin only)
- Admin UI page to view issues and take action
- File replacement system: verify correct checksum → replace → resolve failure status

### Public Server File Handling

- File metadata syncs to public server even when actual files are restricted (default: level 1 only)
- Configurable per access level by archivists in private server UI
- Missing file UX: disabled download buttons with "Contact archive for access" message
- API: `download_available: false, download_url: null, access_message: "..."`

### API Integration

- Internal API: full CRUD at `/internal/v1/files/`
- Public API: read-only at `/api/v1/files/` with access level filtering
- Separate serializers for internal vs public
- Checksums available via public API for user verification

---

## Stage 3: Public/Private Infrastructure

**Goal**: Full dual-deployment infrastructure with cross-server communication.

**Status**: Planned. Prerequisite: Stage 2 complete (File model).

### 7-Volume Storage System

**Public server volumes**:

| Volume | Purpose | Cleanup |
|--------|---------|---------|
| `upload_quarantine` | Initial upload destination | Files moved to `scan_output` after virus scan |
| `scan_output` | Clean files awaiting private server pickup | Removed after private server copies |
| `public_storage` | Curated files for public access (`/files/{collection}/{catalog}/`) | Permanent |
| `temp_storage` | Temporary restricted access sharing | Files older than 24h removed every 6h (Celery) |
| `sync_data` | DB sync data exchange (timestamped JSON) | Removed after successful import |

**Private server volumes**:

| Volume | Purpose | Cleanup |
|--------|---------|---------|
| `ingest_queue` | Files copied from public, awaiting ingestion | Moved to `main_storage` after ingestion |
| `main_storage` | Complete file repository | Permanent |

### 8-Step File Processing Pipeline

| Step | Action | Location |
|------|--------|---------|
| 1 | Upload to public server | `upload_quarantine` |
| 2 | Public virus scan (every 5 min) | `upload_quarantine` → `scan_output` |
| 3 | Cross-server copy (rsync over SSH) | `scan_output` (public) → `ingest_queue` (private) |
| 4 | Private ingestion + optional secondary virus scan | `ingest_queue` → `main_storage` |
| 5 | Private publishing (access-level filtered) | `main_storage` → `public_storage` + `sync_data` |
| 6 | Public DB sync processing | `sync_data` → public database |
| 7 | Temporary sharing (beyond MVP) | `main_storage` → `temp_storage` |
| 8 | Auto-cleanup (every 6h, files >24h old) | `temp_storage` |

### Network Security Model

**Unidirectional**: private server → public server only. Public server has **no network access** to private server.

- Communication method: volume-based rsync, no direct server-to-server API calls
- SSH access on custom port for file transfer
- Private server controls all timing and content of data transfers
- Cultural sensitivity maintained via access level filtering

### Database Synchronization

**Event-driven, checksum-based, private server always wins.**

Architecture:
- Django model signals trigger sync Celery tasks (batched within time windows)
- SHA-256 checksums for change detection — only changed records exported
- Private server generates incremental JSON exports written to `sync_data` volume
- Public server monitors `sync_data` and processes files chronologically

Reliability:
- Conflict resolution: private server always wins (no conflict detection needed)
- Retry: 3 attempts with exponential backoff
- Rollback: transaction-based rollback of entire file on any failure
- Failed files kept for debugging; successful files removed

Field-level filtering: sensitive fields excluded from public database sync (implemented in DRF serializers).

### Cultural Sensitivity Integration

Default: only access level 1 materials sync to public server.

Archivist UI on private server allows configuration of which access levels sync. Both file publishing and database export respect these settings. File metadata syncs even when actual files are restricted.

### Virus Scanning (Multi-Stage)

Two scanning points:

| Location | Scans | Interval |
|----------|-------|---------|
| Public server | `upload_quarantine` → `scan_output` | Every 5 min |
| Private server | `ingest_queue` → `main_storage` | Every 5 min (optional secondary) |

Current status: virus scanner services are defined in docker-compose files but commented out for deployment simplicity. Ready to uncomment and configure in Stage 3.

### Temporary File Sharing (temp_storage)

MVP implementation: volume exists, Celery cleanup task runs every 6h removing files >24h old, nginx configured to serve from `temp_storage`.

Beyond MVP: archivist UI to select files for temporary sharing, private server push mechanism, time-limited access URLs.

### Administrative Interfaces

Available only on private server, for archivists and administrators:
- Configure which access levels sync to public server
- Monitor file and database synchronization status
- View sync operation logs and error reports
- Manual trigger for sync operations
- Virus scanning configuration and monitoring
- Volume usage and cleanup status

---

## Stage 4: Miscellaneous Improvements

**Goal**: Enhance existing functionality across the system.

**Status**: Planned. No specific dependencies; can run parallel to other stages.

**Known backlog items (from technical debt registry)**:
- Replace `django-video-encoding` library (maintenance issues with current version)
- Multi-file upload UI update (required due to Django 5 FileInput API changes)
- Endpoint classification cleanup (resolve duplicate internal/public languoid paths)
- Remove temporary `kavon` user migrate-view permissions (replaced with proper group permissions)
- API authentication simplification: simplify from complex OAuth2 to 2-tier model (API key for trusted consumers, session for web frontend)

**Planned scope**:
- Advanced search capabilities
- Reporting and analytics
- Data quality tools
- Bulk operations beyond batch editing
- UI/UX refinements
- Performance optimizations

---

## Stage 5: LTO Backup System

**Goal**: Long-term archival storage on LTO tape.

**Status**: Planned. Prerequisite: Stage 2 complete (File model).

**Scope**:
- LTO tape management
- Automated backup workflows
- Restore procedures
- Integrity verification against stored checksums
- Retention policies

**Strategic value**: Long-term preservation compliance for linguistic/cultural archive materials.

**Planning detail (encyclopedia grouping, university >1TB constraints, dashboard sketch):** `stage-5-lto.md`

---

**See also**:
- `stages-overview.md` — High-level stage sequence and rationale
- `stage-5-lto.md` — Stage 5 LTO and backup planning outline
- `stage-1-batch-editing.md` — Current stage details
- `../00-ESSENTIAL/active-work.md` — Current priorities
