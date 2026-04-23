# Login and homepage UX (2025-10)

**Context note (2025-10-28, revised if UX changes):** Login and homepage work session; verify against `App.tsx`, auth pages, and `Footer` patterns in `02-PATTERNS/frontend.md`.

**Summary of shipped behavior:**

- **Navigation:** Show **Login** in nav when unauthenticated; authenticated nav includes main app sections + user info (`Navigation.tsx`).
- **Homepage:** Unauthenticated users see message that the system is for authorized staff/archivists and a prominent **Login** CTA; authenticated users see welcome and section overview (`HomePage.tsx`).
- **Routing:** Dedicated `/login` route in `App.tsx` (verify in current `App.tsx`).
- **Accessibility:** Login control meets touch-target guidance (e.g. 44–48px targets; verify in implementation).

**Detail:** Original JSON contains field-by-field implementation notes; behavior should match current React source if docs drift.
