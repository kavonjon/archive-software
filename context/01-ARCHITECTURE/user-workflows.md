# User workflows

**Context note (2025-11-13, revised periodically):** How museum staff, devices, and API consumers are expected to use the system. **Permissions detail:** `security.md`. Expand when user research adds new patterns.

---

## Museum staff and roles (workflow_001)

Group-based access supports daily archive work with clear separation of duties.

### Role categories (conceptual)

| Category | Access | Typical users | Distinct capabilities |
|----------|--------|---------------|------------------------|
| Administrators | Full system + Django admin | System admins, technical managers | Server management, user roles, DB, configuration |
| Archivists | Full data ops + Django admin | Senior / technical archivists | Admin UI, advanced ops, troubleshooting |
| Museum Staff | Full editing via **React**, no Django admin | Curators, collection managers, assistants, students | All routine operational tasks; no accidental backend access |
| Read-only | View all | Researchers, interns, temp staff | Browse, search, export filtered views, read metadata |

**Note:** Exact Django groups and API behavior are defined in `security.md` (Archivist, Museum Staff, Read-Only, superuser).

### Daily workflows (most frequent)

- Edit single records or use **batch editing** (desktop/tablet)
- Upload files
- View items and collections (mobile-friendly browsing)
- Spreadsheet-style exports
- Search across Items, Collections, Collaborators, Languoids
- **Field work:** quick lookups and light edits on phone

### Device expectations

- **Phone:** Lookups, basic viewing, simple edits
- **Tablet:** Data entry, batch editing, review
- **Desktop:** Heavy batch work, uploads, admin tasks

The UI should stay responsive; batch features remain important for productivity.

### Why groups matter

- Museum Staff avoid Django admin mistakes
- Clear boundaries reduce confusion
- Group membership can change without rewriting code paths
- Operational staff are protected from destructive backend actions

---

## API consumers (workflow_002)

External systems using the **public API**:

**Typical workflows**

- OAI-PMH metadata harvesting for discovery (endpoint may still be planned—see `system-overview.md`)
- Public website consuming metadata and files
- Automated metadata sync

**Access patterns (target architecture)**

- Open harvesting tier (rate-limited public read)
- Privileged tier: API key or token for full metadata and file access

See `endpoint-catalog.md` and `system-overview.md` for current auth and routes.

---

## Search, filter, export (workflow_004–005)

**Capabilities:** keyword search, collaborator/language/collection/access filters, search forms, dropdowns, result lists.

**Export:** Excel workbooks with styled headers (e.g. collaborator exports); researchers and archivists use exports for offline analysis. Batch editors add additional export/import patterns (`02-PATTERNS/batch-editors.md`).

---

## Collaborator list page (workflow_006)

### Empty-field quick filters

**Purpose:** Jump to records with missing or unspecified values.

**Button order (preserve UX):**

1. Other Names: Empty  
2. Anonymous: Not Specified  
3. First and Middle Name(s): Empty  
4. Tribal Affiliations: Empty  
5. Native Languages: Empty  
6. Other Languages: Empty  

Each toggles the corresponding filter (e.g. anonymous null/not specified). Order reflects logical data-entry priority.

### Language text filters

- `native_languages_contains` / `other_languages_contains`: case-insensitive text search on language names.
- M2M joins may require `.distinct()` on querysets to avoid duplicate rows.
- Labeling: use **“First and Middle Name Contains”** where that is the convention (not a shortened “First Name” label if it mismatches the field).

### Batch edit modes

- **selected:** Checkbox-selected rows only; no warning dialog.
- **filtered:** Filter applied; **warning** if “all matching rows” might be huge—**only when no advanced filters** narrow scope (align with `batch-editors.md` if changing behavior).
- **empty:** Blank grid start; no warning.
- **Persisted config shape (conceptual):** `{ mode: 'selected' | 'filtered' | 'empty', ids: number[], timestamp: number }`

---

## Future workflow analysis

Legacy JSON reserved sections for search patterns, navigation, export usage, and access workflows—**intentionally empty**. Fill when PM schedules user research.
