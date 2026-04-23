# Mode-specific code (`SERVER_ROLE`)

**Context note (2025-01-04, revised periodically):** `SERVER_ROLE`, queues, and mode-specific behavior. **Overlap:** `01-ARCHITECTURE/infrastructure.md` is the primary story; this file holds extra **task- and code-path-level** notes.

---

## Server mode (mode_001)

- `SERVER_ROLE = os.environ.get('SERVER_ROLE', 'public')` — values `public` | `private`.
- `deploy.sh` validates role; picks `docker-compose.public.yml` vs `docker-compose.private.yml` (mode_002).
- `dev.sh`: public worker queues `public,common`; private `private,common` (mode_003).

## Storage paths (mode_004–005)

- **Public:** `PUBLIC_STORAGE_PATH`, temp and sequestered paths under public layout.
- **Private:** `MAIN_STORAGE_PATH` and parallel relative paths.
- **`file_utils.get_main_storage_base()`** returns private main vs public public base as appropriate.

## Celery routing (mode_006)

- `metadata.tasks.*` → `public` or `private` queue by role; `common.tasks.*` → `common`.

## Task behavior (mode_007–009)

- **process_scanned_files:** destination `PUBLIC_STORAGE_PATH` if public else `MAIN_STORAGE_PATH` (`metadata/tasks.py`).
- **cleanup_temp_files:** **public only** — early return if not public.
- **sync_public_files:** **private only** — early return if not private.

## Model hooks (mode_010)

- **Collection.save:** private role may take extra metadata paths (verify line references in current `models.py` in the codebase).

## Docker (mode_011–012)

- Different volume mounts per compose file (public: public_storage, sequestered, sync_data, etc.; private: main_storage, backup, etc.).
- Private may set `PUBLIC_SERVER_URL`, `PUBLIC_REDIS_URL` for cross-server operations.

## Principles (mode_013–015)

- Most code shared; mode-specific concentrated in storage, Celery, Docker, file pipeline.
- Legacy “in development” list: cross-server sync, DB sync automation, full virus scanning, advanced publishing—align with `active-work.md`.
