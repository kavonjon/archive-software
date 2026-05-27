# App shell patterns (reference)

**Context note (2026-05-26):** Authentication flow, home-page footer, favicon/PWA, and in-app user guide (content, build/copy, contextual help). Layout and routing concerns outside entity-specific pages.

**See also:** Security groups and permissions in `01-ARCHITECTURE/security.md`. Accessibility for footer content in `02-PATTERNS/accessibility.md`. User guide file inventory in `../docs-directory.md`.

---

## Authentication UX

### Login flow

```
Unauthenticated user hits protected route
    -> ProtectedRoute component intercepts
    -> Saves current location as state.from
    -> Redirects to /login
    -> After successful login, navigate to state.from (or /items as default)
```

**Implementation**:
```typescript
// ProtectedRoute
const location = useLocation();
if (!isAuthenticated) {
  return <Navigate to="/login" state={{ from: location }} replace />;
}

// After login success
const from = (location.state as any)?.from?.pathname || '/items';
navigate(from, { replace: true });
```

**Default redirect**: `/items` (when no `state.from` saved)

---

## Footer

`Footer.tsx` is displayed **on the home page only** (not on internal app pages).

**Contents**: NEH funding acknowledgment, WCAG compliance badge, contact information.

**Pattern**: Render conditionally in the root layout based on current route.

---

## Favicon and PWA

The project has favicon and PWA manifest configured. When updating favicon or icons:
- Update `public/favicon.ico`
- Update `public/manifest.json` (PWA metadata)
- Update `public/index.html` (meta tags)

---

## In-app user guide

The app renders staff documentation at `/user-guide` from Markdown in `docs/user-guide/`. PM-triggered authoring only — do not add user-facing docs without PM approval.

### Rendering

**Page:** `frontend/src/pages/UserGuidePage.tsx`

- Fetches markdown files at load time (not bundled in JS)
- `ReactMarkdown` + `remark-gfm` + `remark-custom-header-id`
- Sticky table of contents (desktop); hash anchors (`/user-guide#item-batch`)
- Nav link: **User Guide** (authenticated users)

**Dev base path:** `/docs/user-guide`  
**Production base path:** `${PUBLIC_URL}/docs/user-guide` (typically `/static/frontend/docs/user-guide`)

### Registered sections (2026-05-26)

| Section ID | Source file |
|------------|-------------|
| `getting-started` | `getting-started.md` |
| `editing-languoids` | `editing-languoids.md` |
| `editing-collaborators` | `editing-collaborators.md` |
| `editing-items` | `editing-items.md` |
| `batch-editor` | `batch-editor/overview.md` |
| `languoid-batch` | `batch-editor/languoid-batch.md` |
| `collaborator-batch` | `batch-editor/collaborator-batch.md` |
| `item-batch` | `batch-editor/item-batch.md` |
| `importing-data` | `batch-editor/importing-data.md` (languoid-focused body) |
| `importing-data-items` | `batch-editor/importing-data-items.md` |
| `keyboard-shortcuts` | `batch-editor/keyboard-shortcuts.md` |

When adding a section: create markdown under `docs/user-guide/`, add fetch entry in `UserGuidePage.tsx`, use `{#anchor-id}` in headings for deep links.

### Build and copy into frontend

**Source of truth:** `docs/user-guide/` (repo root)

**Scripts** (`frontend/package.json`):

| Script | When | Action |
|--------|------|--------|
| `prestart` | Before `npm start` | `cp -r ../docs/user-guide public/docs/` |
| `prebuild` | Before `npm run build` | Same copy to `public/docs/` |
| `copy-to-django` | After production build | Copy build + `docs/user-guide` → `app/static-files/frontend/docs/` |

**Local dev:**
```bash
cd frontend && npm start   # prestart copies docs automatically
```

If the dev server is **already running** after markdown-only edits, restart `npm start` or manually:
```bash
mkdir -p frontend/public/docs && cp -r docs/user-guide frontend/public/docs/
```

**Production (TrueNAS / Django static):**
```bash
cd frontend && npm run build:django
```
Commit `app/static-files/frontend/` including updated `docs/user-guide/` under static files. Deploy scripts do not build the frontend.

### Contextual help (InfoIconLink)

**Component:** `frontend/src/components/common/InfoIconLink.tsx`

Opens `/user-guide#{anchor}` in a new tab. Currently wired in batch editor toolbar only (`TanStackSpreadsheetWrapper.tsx`).

**Guide anchors by batch editor `modelName`:**

| modelName | Anchor |
|-----------|--------|
| `Items` | `item-batch` |
| `Collaborators` | `collaborator-batch` |
| `Languages` | `languoid-batch` |
| (fallback) | `batch-editor` |

**Note:** Languoid batch editor passes `modelName="Languages"`, not `Languoids`.

### Model coverage (user guide)

| Model | Single edit | Batch | Import |
|-------|-------------|-------|--------|
| Languoid | Yes | Yes | Yes (importing-data.md) |
| Collaborator | Yes | Yes | In collaborator-batch.md |
| Item | Yes (2026-05-26) | Yes | Yes (importing-data-items.md) |
| Collection | No | No | No |
| Document | No | No | No |
