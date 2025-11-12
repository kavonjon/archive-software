# URL Routing Architecture

**Purpose:** This document explains how URL routing works in the archive management system, including the dual-mode architecture that serves both React frontend routes and Django backend routes.

## Overview

The system uses a hybrid routing architecture:
- **Django URL patterns** handle backend routes (admin, APIs, Django templates)
- **React Router** handles frontend routes (items, collections, collaborators, languoids)
- **Catch-all pattern** with negative lookahead ensures proper separation

## URL Pattern Priority

Django processes URL patterns sequentially from top to bottom in `app/archive/urls.py`. The ordering is critical:

1. **Backend Routes** (highest priority)
   - Django Admin
   - Authentication endpoints
   - API endpoints
   - Django template views
   - Export/health check endpoints

2. **React Routes** (lowest priority)
   - React home page
   - Catch-all for unmatched routes

## Backend Routes

### Django Admin
```
/admin/                     → Django administration interface
```

### API Documentation
```
/api/docs/                  → Swagger UI (interactive API docs)
/api/redoc/                 → ReDoc (alternative API docs)
/api/schema/                → OpenAPI schema (JSON/YAML)
```

### Public API
```
/api/v1/items/              → Items API (DRF)
/api/v1/collections/        → Collections API (DRF)
/api/v1/collaborators/      → Collaborators API (DRF)
/api/v1/languoids/          → Languoids API (DRF)
/api/v1/map/items/          → Map API (GeoJSON)
```

### Internal API
```
/internal/items/            → Internal items API (for React frontend)
/internal/collections/      → Internal collections API
/internal/collaborators/    → Internal collaborators API
/internal/languoids/        → Internal languoids API
```

### Authentication
```
/auth/csrf/                 → CSRF token endpoint
/auth/login/                → Login API
/auth/logout/               → Logout API
/auth/status/               → User status check
/accounts/login/            → Django login page
/accounts/logout/           → Django logout
```

### Django Template Views (Development)
```
/django/                    → Django template home
/django/items/              → Items list (Django templates)
/django/collections/        → Collections list
/django/collaborators/      → Collaborators list
/django/languoids/          → Languoids list
```

### Export and Health
```
/collaborators/export-task-status/<task_id>/    → Export task status
/collaborators/download-export/<filename>/      → Download export file
/collaborators/cleanup-export/<filename>/       → Cleanup export file
/celery-health/                                 → Celery health check
```

### Static and Media
```
/static/                    → Static files (CSS, JS, images)
/media/                     → User-uploaded media files
```

## React Routes (Frontend)

All these routes are handled by React Router on the client side:

```
/                           → React home page
/login                      → React login form
/user-guide                 → User guide page
/items/                     → Items list (React)
/items/:id/                 → Item detail
/collections/               → Collections list (React)
/collections/:id/           → Collection detail
/collaborators/             → Collaborators list (React)
/collaborators/:id/         → Collaborator detail
/languoids/                 → Languoids list (React)
/languoids/:id/             → Languoid detail
```

## Catch-All Pattern Implementation

The catch-all pattern uses **negative lookahead** to exclude backend paths:

```python
re_path(
    r'^(?!admin/|api/|django/|accounts/|select2/|o/|auth/|metadata/|'
    r'collaborators/export-|collaborators/download-|collaborators/cleanup-|'
    r'celery-health/|media/|static/).*$',
    ReactAppView.as_view(),
    name='react_catchall'
)
```

### How It Works

**Negative Lookahead:** `(?!pattern)`
- Matches only if the URL does **not** start with any excluded pattern
- Allows precise control over which paths go to React vs Django

**Excluded Patterns:**
- `admin/` - Django admin
- `api/` - All API endpoints
- `django/` - Django template views
- `accounts/` - Django auth views
- `select2/` - Django Select2 widgets
- `o/` - OAuth2 provider
- `auth/` - Custom auth API
- `metadata/` - Metadata API
- `collaborators/export-` - Export endpoints (specific prefix)
- `collaborators/download-` - Download endpoints
- `collaborators/cleanup-` - Cleanup endpoints
- `celery-health/` - Health check
- `media/` - Media files
- `static/` - Static files

**Why Specific Collaborator Prefixes?**

The pattern excludes `collaborators/export-` but allows `collaborators/` because:
- `/collaborators/` → React frontend (list/detail pages)
- `/collaborators/export-task-status/...` → Django backend (API endpoint)

This allows React to handle the main collaborators UI while Django handles export-related API endpoints.

## ReactAppView Safety Check

The `ReactAppView` class includes a safety check that prevents serving React for backend paths:

```python
# Safety check: If somehow we're being called for a backend path, return 404
path = request.path
backend_prefixes = [
    '/admin/', '/api/', '/django/', '/accounts/', '/select2/', 
    '/o/', '/auth/', '/metadata/', '/celery-health/', '/media/', '/static/'
]

for prefix in backend_prefixes:
    if path.startswith(prefix):
        return HttpResponseNotFound('Path should not be handled by React')
```

This is a defensive programming practice - if the URL patterns are correct, this code should never execute.

## Development Modes

### Mode 1: Django Only (Backend Testing)

**When to use:** Testing backend, APIs, admin interface, or production-like environment

**Setup:**
```bash
cd app
pipenv run python manage.py runserver
```

**Access:**
- Django: `http://localhost:8000`
- Admin: `http://localhost:8000/admin/`
- API docs: `http://localhost:8000/api/docs/`
- React frontend: `http://localhost:8000/` (served as static build)

**Behavior:**
- Django serves everything
- React app loaded as pre-built static files
- URL routing works exactly as documented above
- This matches production behavior

### Mode 2: React Dev Server (Frontend Development)

**When to use:** Developing React components with hot-reload

**Setup:**
```bash
# Terminal 1: Django backend
cd app
pipenv run python manage.py runserver

# Terminal 2: React dev server
cd frontend
npm start
```

**Access:**
- React dev: `http://localhost:3000` (with hot-reload)
- Django: `http://localhost:8000` (direct backend access)

**Behavior:**
- React dev server proxies API calls to Django
- React Router handles ALL routing on port 3000
- `/admin/` and `/api/docs/` not accessible on port 3000
- Use `localhost:8000/admin/` for direct Django access

**Important:** In this mode, you must access backend routes directly via port 8000, not through the React dev server on port 3000.

## Production Deployment

In production, only Mode 1 is used:
- React app is pre-built (`npm run build:django`)
- Django serves both backend and frontend
- Nginx may provide additional routing at the infrastructure level
- URL routing behavior matches Mode 1 exactly

## URL Resolution Testing

To test URL resolution:

```bash
cd app
pipenv run python manage.py shell -c "
from django.urls import resolve

# Test backend routes
for url in ['/admin/', '/api/docs/', '/api/v1/items/']:
    match = resolve(url)
    print(f'{url} → {match.view_name}')

# Test frontend routes
for url in ['/items/', '/collections/', '/collaborators/']:
    match = resolve(url)
    print(f'{url} → {match.view_name}')
"
```

Expected output:
```
/admin/ → admin:index
/api/docs/ → swagger-ui
/api/v1/items/ → item-list
/items/ → react_catchall
/collections/ → react_catchall
/collaborators/ → react_catchall
```

## Troubleshooting

### Issue: `/admin/` shows blank React page

**Cause:** React dev server is running on port 3000 and you're accessing it through that port.

**Solution:** Either:
- Access Django directly at `http://localhost:8000/admin/`
- Stop React dev server and use Django-only mode

### Issue: React routes show 404

**Cause:** React build is missing or outdated.

**Solution:**
```bash
cd frontend
npm run build:django
```

### Issue: API calls fail from React

**Cause:** React dev server proxy not configured or Django not running.

**Solution:** Ensure both servers are running in Mode 2, or use Mode 1 (Django only).

## Architecture Diagram

```
Browser Request: http://localhost:8000/admin/
    ↓
Django URL Resolver (archive/urls.py)
    ↓
Matches pattern #1: path('admin/', admin.site.urls)
    ↓
Django Admin View
    ↓
Response: Django Admin HTML


Browser Request: http://localhost:8000/items/
    ↓
Django URL Resolver (archive/urls.py)
    ↓
No match in patterns #1-#68
    ↓
Matches pattern #69: re_path(r'^(?!admin/|api/...).*$', ReactAppView)
    ↓
ReactAppView.get()
    ↓
Serves: static-files/frontend/index.html
    ↓
Browser loads React app
    ↓
React Router handles /items/ route
    ↓
Response: React Items List Component
```

## Related Files

- **`app/archive/urls.py`** - Main URL configuration
- **`app/frontend_views.py`** - ReactAppView implementation
- **`app/api/urls.py`** - API URL patterns
- **`app/internal_api/urls.py`** - Internal API URL patterns
- **`frontend/src/App.tsx`** - React Router configuration

## See Also

- [Django URL Dispatcher](https://docs.djangoproject.com/en/stable/topics/http/urls/)
- [React Router Documentation](https://reactrouter.com/)
- [Python Regex - Negative Lookahead](https://docs.python.org/3/library/re.html#regular-expression-syntax)

