# System Overview

## Architecture

### Separated Frontend/Backend (Since 2025-01-04)

```
Frontend (React SPA)          Backend (Django)
localhost:3000 to localhost:8000
├─ Hot reload                 ├─ REST API (/internal/v1/)
├─ TypeScript + Vite          ├─ Django Admin (/admin/)
└─ Material-UI                ├─ Celery Workers
                              └─ PostgreSQL + Redis
```

**Communication**: 
- CORS configured for cross-origin (django-cors-headers)
- Session-based auth with CSRF tokens
- API calls via `services/api.ts`

**Development**:
- Two terminals: `./dev.sh` (backend) + `npm start` (frontend)
- Independent deployment capability
- Hot reload on both sides

## Tech Stack

### Backend

**Core:**
- Python 3.11
- Django 5.0.14 (upgraded from 3.2 in 2025-10-xx)
- Django REST Framework 3.16.1
- django-cors-headers 4.5.0
- PostgreSQL 14+

**Background Processing:**
- Celery (async tasks: exports, cache building, hierarchy updates)
- Redis (Celery broker, result backend, data caching)

**Key Libraries:**
- django-cors-headers (cross-origin)
- openpyxl (Excel export/import)
- celery[redis] (task queue)

### Frontend

**Core:**
- React 18
- TypeScript 5+
- Material-UI (MUI) 5
- React Router 6

**Batch Editors:**
- TanStack Table v8 (@tanstack/react-table)
- Custom cell editors for complex fields

**Build:**
- Vite (dev server + bundler)
- ESLint + TypeScript compiler

### Infrastructure

**Development:**
- macOS (darwin 24.6.0)
- Pipenv (Python dependency management)
- npm (JavaScript dependency management)

**Production:**
- Single Django server serves both API and React build
- Static files: React build to Django static directory
- URL routing: Backend routes first, React catch-all last

## Deployment Architecture

### Dual-Server Architecture Overview

**Purpose**: Separate culturally sensitive materials from public-accessible materials while enabling both internal workflows and public API access.

**Primary Driver**: Cultural sensitivity requirements (see `cultural-context.md`)

**Architecture**:
- **Private Server**: Behind firewall, internal IP only, full archive access, can reach public server
- **Public Server**: Internet-facing, access level 1 materials only, receives uploads, hosts public API

**Data Flow**: Public receives uploads to Private processes to Private publishes subset back to Public

**Current Status**: System deployed in production on private server with real data. All changes MUST be backward compatible.

**For Details**: See `infrastructure.md` for complete 7-volume architecture, 8-step file processing pipeline, database synchronization, virus scanning, and TrueNAS deployment

### Django Apps

**Main Apps:**
- `metadata` - Core models (Item, Collaborator, Languoid, Collection, Document)
- `internal_api` - REST API for React frontend
- `api` - Public API (maps, search)
- `archive` - Project settings and configuration
- `frontend_views` - Serves React SPA in production

**Structure:**
- Models in `models.py`
- Business logic in `services.py`
- REST endpoints in `internal_api/views.py`
- Async tasks in `tasks.py`
- Computed fields in `signals.py`

## URL Routing

### Development (Two Servers)
- Frontend: http://localhost:3000 (React dev server)
- Backend: http://localhost:8000 (Django)
- Frontend calls backend via CORS

### Production (Single Server)
Django serves everything on port 8000:

**Route Priority Order:**
1. `/admin/` - Django admin
2. `/api/` - Public REST API  
3. `/internal/v1/` - Internal REST API
4. `/django/` - Legacy Django templates
5. `/` (exact) - React app
6. `^admin$` - Redirect to `/admin/`
7. `^api$` - Redirect to `/api/`
8. `*` (catch-all) - React app (with negative lookahead)

**Critical**: Explicit redirects for no-slash URLs must come BEFORE catch-all.

## Data Flow

### Read Flow
```
User - React Component - services/api.ts - DRF ViewSet - Django Model - PostgreSQL
                                              ↓
                                         Redis Cache
                                         (for lists)
```

### Write Flow
```
User - Batch Editor - handleSaveAll - itemsAPI.saveBatch() - ViewSet.save_batch()
                                                                    |
                                        Bulk update (Django ORM) - PostgreSQL
                                                                    |
                                        Signal: Compute derived fields
                                                                    |
                                        Signal: Invalidate cache - Celery task rebuild
```

### Export Flow (Async)
```
User clicks Export - Frontend creates export request with UUID
                          ↓
                     Backend: IDs provided? Sync export : Celery task (async)
                          ↓
                     Generate XLSX with openpyxl, save to media/exports/
                          ↓
                     Frontend polls /export-status/{uuid}/ every 2s
                          ↓
                     Download with timestamp filename (YYYY-MM-DD_HHMMSS.xlsx)
```

### Cache Flow
```
First request - Cache miss - Return 202 Accepted
                               ↓
                          Celery task: Build cache
                               ↓
                          Store in Redis (TTL: 1 hour)
                               ↓
Frontend polls - Cache ready - Return data (200 OK)
```

## File Organization

### Backend (`app/`)
```
app/
├── metadata/              # Core models and logic
│   ├── models.py         # Item, Collaborator, Languoid, etc.
│   ├── services.py       # Business logic layer
│   ├── signals.py        # Computed fields, integrity enforcement
│   ├── tasks.py          # Celery tasks (exports, cache, hierarchy)
│   ├── admin.py          # Django admin customizations
│   └── migrations/       # Database schema changes
│
├── internal_api/         # React frontend API
│   ├── views.py          # ViewSets with batch actions
│   ├── serializers.py    # Full + Batch serializers per model
│   └── permissions.py    # Group-based permission classes
│
├── api/                  # Public API
│   └── v1/              # Map endpoints, GeoJSON
│
└── archive/              # Project settings
    ├── settings.py       # Django configuration
    └── urls.py          # URL routing
```

### Frontend (`frontend/src/`)
```
frontend/src/
├── components/
│   ├── items/           # Item list, detail, batch editor
│   ├── collaborators/   # Collaborator list, detail, batch editor
│   ├── languoids/       # Languoid list, detail, batch editor
│   ├── batch/          # Shared batch editor components
│   │   ├── CellEditor.tsx          # Standard cell types
│   │   ├── CollaboratorRolesCellEditor.tsx  # Through-model editor
│   │   └── TitleWithLanguageCellEditor.tsx  # Text+FK editor
│   └── common/         # Reusable components
│
├── contexts/           # React contexts
│   ├── ItemCacheContext.tsx
│   ├── CollaboratorCacheContext.tsx
│   └── LanguoidCacheContext.tsx
│
├── services/          # API and utilities
│   ├── api.ts        # API client, interfaces, choice constants
│   ├── itemImportColumnMapper.ts
│   ├── itemImportTransformer.ts
│   └── itemImportValueParsers.ts
│
├── hooks/            # Custom React hooks
│   ├── useImportItemSpreadsheet.ts
│   ├── usePersistedListState.ts
│   └── usePageTitle.ts
│
└── types/           # TypeScript definitions
    └── spreadsheet.ts
```

## Service Layer Pattern

**Principle**: Business logic in service classes, not views or tasks

**Benefits**:
- Reusable across views, tasks, management commands
- Testable in isolation
- Thin views (just orchestration)

**Current Services** (`app/metadata/services.py`):
- `CollaboratorService` - Filtering, exports, anonymous handling
- `ExportService` - Shared export utilities
- `FilterService` - Complex filtering logic

## Signals Architecture

**Purpose**: Automatic computation of derived fields

**Pattern**: Use `pre_save` signals for synchronous field computation

**Examples**:
- `compute_collaborator_derived_fields`: full_name, slug, date min/max
- `compute_languoid_derived_fields`: level_nal, hierarchy FKs
- `update_item_date_ranges`: browse_categories, collection auto-assignment
- `standardize_item_dates`: Date format conversion (MM/DD/YYYY to YYYY/MM/DD)

**M2M Enforcement**: Use `m2m_changed` signals for relationship rules
- `auto_add_parent_language_for_collaborator_dialects`: Ensures parent languages present

**Critical**: Some signals trigger Celery tasks for expensive operations (Languoid hierarchy)

## Celery Task Architecture

**Queue Priority Levels** (0-10):
- Priority 10: User-facing (exports)
- Priority 9: Data integrity (hierarchy updates)
- Priority 8: Cache invalidation
- Priority 5: Cascading updates (delayed)

**Common Tasks**:
- `generate_item_export_task` - Async XLSX export
- `warm_item_list_cache` - Build Redis cache
- `update_languoid_hierarchy_task` - Maintain descendents M2M
- `invalidate_and_warm_languoid_cache` - Cache refresh

**Error Handling Pattern**:
```python
@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def my_task(self, ...):
    try:
        # task logic
        return {'status': 'success', ...}
    except Exception as e:
        logger.error(f"Task failed: {e}")
        return {'status': 'error', 'error': str(e)}
```

**Don't use** `raise self.retry()` - can cause silent failures.

## Redis Caching Pattern

**Use Case**: Large list views (>1000 rows) for batch editor

**Flow**:
1. ViewSet.list() checks Redis cache
2. Cache hit - Return data (200 OK)
3. Cache miss/stale - Return 202 Accepted, trigger Celery rebuild task
4. Frontend polls until cache ready
5. Cache has TTL (1 hour), auto-rebuilds on model save

**Redis Port**: 6387 (non-standard - ensure config matches)

**Keys**:
- `item_list_full` - Full Item cache
- `collaborator_list_full` - Full Collaborator cache
- `languoid_list_full` - Full Languoid cache

**Commands**:
```bash
# View cache
redis-cli -p 6387 GET item_list_full

# Clear all cache
redis-cli -p 6387 FLUSHALL

# Clear specific cache
redis-cli -p 6387 DEL item_list_full
```

## API Architecture

### API Classification

**Two Distinct APIs with Different Purposes:**

**Internal API** (`/internal/v1/`):
- Purpose: Full CRUD for React frontend
- Authentication: Django session
- Access: Museum staff workflows only
- Documentation: Code comments only (not public)
- Operations: Read, write, batch operations
- Versioning: Simple `/internal/v1/` prefix

**Public API** (`/api/v1/`):
- Purpose: Read-only access for external consumers and public website
- Authentication: OAuth2 token required
- Access: Open to external developers
- Documentation: OpenAPI 3.0 at `/api/docs/` and `/api/redoc/`
- Operations: Read-only GET requests
- Versioning: Frozen stable versions (v1, v2, v3...)

**IMPORTANT**: Do not confuse these two APIs. They serve different audiences and have different requirements.

### Internal API (`/internal/v1/`)

**Purpose**: Full CRUD for React frontend

**Endpoints**: `/items/`, `/collaborators/`, `/languoids/`, `/collections/`, `/documents/`

**Actions**:
- Standard: list, retrieve, create, update, partial_update, destroy
- Custom: `save_batch`, `export`, `export_status`, `validate_field`

**Serializers (Two Per Model)**:
- **Full Serializer**: All fields, display values, for detail/create/update
- **Batch Serializer**: Minimal fields, for list with `batch=true`, optimized for caching

**Query Parameters**:
- `batch=true` - Use batch serializer (lighter)
- `picker=true` - Use picker serializer (ultra-light for dropdowns)
- Standard: `page`, `page_size`, `ordering`, filter fields

**Authentication**: Django session-based, CSRF tokens

**Documentation**: Internal use only, not included in public OpenAPI docs (excluded via `spectacular_hooks.py`)

### Public API (`/api/v1/`)

**Purpose**: Read-only access for external consumers and public website

**Current Endpoints**:
- `/api/v1/items/` - Archive items with metadata
- `/api/v1/collections/` - Archive collections
- `/api/v1/languoids/` - Language/dialect information
- `/api/v1/collaborators/` - Collaborator information
- `/api/v1/map/items/` - GeoJSON geographic data for map visualization

**Authentication**: OAuth2 token (permission class: `IsAdminOrHasToken`)

**Exception**: `/api/v1/map/items/` uses `AllowAny` (no authentication required for map data)

**Map Endpoint Features** (added 2025-11-12):
- Format: GeoJSON FeatureCollection (RFC 7946)
- Required params: `bbox` (west,south,east,north)
- Optional params: `zoom` (0-20), `collection` (abbreviation)
- Filtering: Database-level via custom FilterBackends (BoundingBoxFilterBackend, DensityFilterBackend, CollectionFilterBackend)
- Coverage: 2,307 items with coordinates (52.5% of archive)
- No GDAL/PostGIS dependency (custom serializer implementation)

**Documentation Tools**:
- drf-spectacular for OpenAPI 3.0 schema generation
- Endpoints:
  - `/api/schema/` - Latest API schema
  - `/api/docs/` - Latest Swagger UI
  - `/api/redoc/` - Latest ReDoc
  - `/api/v1/schema/` - v1-specific schema
  - `/api/v1/docs/` - v1-specific Swagger UI
  - `/api/v1/redoc/` - v1-specific ReDoc

**Documentation Organization**:
- Group by resource type (items, collections, languoids, collaborators, map), NOT by version
- Rationale: Version is in URL; consumers care about "what can I do" not "what version am I using"
- Consumer-facing guide: `docs/api/map-endpoint-guide.md` for external developers

### API Versioning Strategy

**Approach**: Frozen stable versions (v1, v2, v3...)

**Current State**: Only v1 exists

**Version Rules**:
- Each version frozen upon release - never changes
- Only additive changes allowed (new fields, new endpoints)
- No breaking changes to existing version
- Breaking changes require new version (v2, v3, etc.)

**Beta Removed** (2025-11-12):
- Beta path removed for simplicity
- Rationale: Infrequent changes don't justify rolling beta complexity
- For infrequent changes, frozen versions are more appropriate

**Future Evolution**:
- When breaking changes needed, release v2 alongside v1
- Support both versions for 12-24 months migration window
- Announce v1 deprecation, provide migration guide
- Maintain overlap period for consumer transition

### Future Public API Evolution

**Planned API Tiers** (MVP target):
- **OAI-PMH endpoint**: Open access, 1,000 req/hr (metadata harvesting for aggregators)
- **Privileged API key**: 100,000 req/hr (partner organizations, public website)
- **OAuth2 read/write**: Separate public website integration (scope: `read`)

**Rationale**: Infrequent external API changes don't justify complex rolling-beta. Frozen versions (v1, v2) with OAI-PMH for metadata harvesting covers the primary use cases at lower implementation cost than heavy OAuth2 infrastructure.

**Current State**: OAuth2 scaffolding exists but OAI-PMH endpoint not yet implemented. Strategic notes: `04-REFERENCE/stage-plans/stage-2-5.md` and `stages-overview.md`.

## Key External Dependencies

### Nominatim (Geocoding)
- **Purpose**: Reverse geocoding for latitude/longitude display
- **User-Agent**: MUST be `ArchiveManagementSystem/1.0` (Nominatim ToS requires valid User-Agent - omitting it gets you blocked)
- **Location**: `leafletConfig.ts` or geocoding service layer

### Key Libraries
- **openpyxl**: Excel export/import (batch editors)
- **mutagen**: Audio/video metadata extraction
- **librosa**: Audio analysis
- **tus.io** (Stage 2): Resumable file uploads for large files
- **remark-gfm**: GitHub Flavored Markdown for in-app user guide (ReactMarkdown plugin)
- **leaflet/react-leaflet**: Map visualization

## Documentation Structure

The project has a `docs/` folder separate from the context system:

```
docs/
├── deployment/
│   └── database-operations.md   # DB backup/restore procedures
├── development/
├── operations/
├── user-guide/                   # End-user documentation (PM-triggered only)
│   └── ...
├── system-behavior/              # System behavior docs (PM-triggered only)
│   └── ...
└── api/
    └── map-endpoint-guide.md     # External developer consumer guide for map API
```

**Critical Protocol**: End-user documentation (`docs/user-guide/`, `docs/system-behavior/`) is written **only when triggered by the PM**. Developers must NEVER proactively create user-facing docs. In-app help is rendered via ReactMarkdown + `remark-gfm`.

### Celery on macOS
- `ctrl+C` on dev.sh doesn't always kill workers
- Use `pkill -9 -f 'celery -A archive'` for hard restart
- Check running: `ps aux | grep celery`

### Frontend State
- `useState` for pagination only has current page (25 rows)
- Use cache context `getItems()` for full dataset operations
- Filters must apply to full cache for export/batch edit

### Django Admin
- Still works alongside React (both can coexist)
- Signals run for Django admin saves too
- Legacy template views exist but deprecated

### Legacy Django Template Endpoints (Still Functional — Must Preserve)

Staff-facing Django **templates** remain mounted under the **`/django/`** prefix in production (see `app/archive/urls.py`). They are not the primary UI but **must not be broken**. Examples:

- `django/items/`, `django/catalog/<pk>/`, `django/catalog/add/`, etc. — item catalog
- `django/collections/...` — collections
- `django/collaborators/...` — collaborators
- `django/languoids/...` — languoids (detail uses string PK, e.g. glottocode)
- `django/documents/...` — legacy document management
- Import/export and column-export paths under `django/...`

**Authoritative checklist:** `preservation.md` for what must not break. Import paths include `django/catalog/import/`, `django/collaborators/import/`, `django/languoids/import/`, etc.

### Browser Refresh
- sessionStorage persists filters, selections, pagination
- New draft rows must be saved to sessionStorage config
- Redis cache persists server-side

---

**See also**: 
- `preservation.md` - Must-not-break constraints (models, API, templates, jobs)
- `cultural-context.md` - Cultural requirements driving architecture
- `infrastructure.md` - Dual-server, storage volumes, deployment
- `../02-PATTERNS/backend.md` - Django/Celery detailed patterns
- `../02-PATTERNS/frontend.md` - React detailed patterns
- `data-models.md` - Entity relationships
