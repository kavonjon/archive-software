# App shell patterns (reference)

**Context note (2026-05-24):** Authentication flow, home-page footer, favicon/PWA, and in-app user guide. Layout and routing concerns outside entity-specific pages.

**See also:** Security groups and permissions in `01-ARCHITECTURE/security.md`. Accessibility for footer content in `02-PATTERNS/accessibility.md`.

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

The app has an in-app help/user guide rendered with ReactMarkdown.

**Dependencies**: `remark-gfm` plugin is required for GitHub Flavored Markdown (tables, strikethrough, etc.)

```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {markdownContent}
</ReactMarkdown>
```

**Content location**: User guide markdown lives in `docs/user-guide/`. These files are PM-triggered only — never write them proactively.
