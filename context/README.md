# Project Context System

**Version 3.5** | Last Updated: 2026-05-24

The **Project Context System** comprises all files in the `context/` folder. When this documentation refers to the Project Context System, it means this file-based persistent knowledge—not the conversation transcript or current chat.

Modern, streamlined context management for development.

## Quick Start

**New to the project?** Read in this order:
1. `00-ESSENTIAL/quickstart.md` - Get oriented in 5 minutes
2. `00-ESSENTIAL/system-inventory.md` - What exists in this tree and where (optional)
3. `00-ESSENTIAL/context-map.md` - Topic → file index (optional)
4. `01-ARCHITECTURE/cultural-context.md` - Understand cultural requirements
5. `01-ARCHITECTURE/preservation.md` - Must-not-break constraints before you change code
6. `01-ARCHITECTURE/system-overview.md` - Understand the stack
7. `02-PATTERNS/batch-editors.md` - Batch editor focus area

**Continuing work?** Check:
- `00-ESSENTIAL/active-work.md` - Current tasks and priorities
- `03-LESSONS/item-batch-editor.md` - Latest implementation patterns

## Directory Structure

```
context/
├── 00-ESSENTIAL/          # Start here - current work and quick reference
│   ├── quickstart.md      # 5-minute orientation
│   ├── system-inventory.md # Folder map and coverage (self-contained)
│   ├── active-work.md     # Current tasks, recent wins, next steps
│   └── context-map.md     # Topic → file index
│
├── 01-ARCHITECTURE/       # System design and key decisions
│   ├── system-overview.md # Tech stack, architecture, APIs
│   ├── infrastructure.md  # Dual-server, storage, deployment
│   ├── preservation.md   # Must-not-break checklist
│   ├── data-models.md     # Core entities and relationships
│   ├── security.md        # Authentication, permissions, groups
│   ├── cultural-context.md # Cultural sensitivity requirements
│   ├── user-workflows.md  # Roles, devices, collaborator list UX
│   └── product-requirements.md # Mission, scope, repository direction
│
├── 02-PATTERNS/           # Reusable implementation patterns
│   ├── batch-editors.md   # Universal batch editor patterns
│   ├── frontend.md        # React, TypeScript, MUI patterns
│   ├── backend.md         # Django, DRF, Celery patterns
│   └── accessibility.md   # ADA compliance requirements
│
├── 03-LESSONS/            # Implementation-specific learnings
│   ├── item-batch-editor.md      # State-of-the-art reference (61 fields)
│   ├── collaborator-batch-editor.md  # Foundation patterns
│   └── multiselect-cell-reactgrid.md # MultiSelect + ReactGrid focus pattern
│
├── 04-REFERENCE/          # Deep dives and catalogs
│   ├── stage-plans/       # Stage 0–5 plans (e.g. stage-5-lto.md)
│   ├── api-docs/
│   │   └── endpoint-catalog.md  # Public vs internal API classification
│   ├── frontend/          # List pages, forms, React conventions, app shell, geographic
│   ├── deployment/
│   │   └── mode-specific-code.md  # SERVER_ROLE task and volume notes
│   ├── dependencies.md    # Third-party policy (versions in Pipfile/npm)
│   ├── docs-directory.md  # Repo docs/ folder map
│   └── field-guides/      # Reserved for future per-model field docs
│
└── 05-ARCHIVE/            # Historical snapshots, debt, planning archives
    ├── deprecated.md      # Removed models, obsolete patterns, Invenio note
    ├── technical-debt-history.md
    ├── decision-genealogy.md
    ├── refactoring-roadmap-snapshot.md
    ├── django-template-inventory-snapshot.md
    ├── architectural-decisions-snapshot.md
    ├── collaborator-harmonization-snapshot.md
    ├── dependency-upgrade-plan-historical.md
    └── login-homepage-ux-2025-10.md
```

## File Organization Principles

### Format: Markdown
- This tree is the **only** home for the Project Context System: maintain it as **Markdown** here (not JSON or ad hoc docs elsewhere for the same role).
- Human-readable, better for diffs, easier to scan, faster to load in tools
- Headers, lists, and code blocks provide natural structure

### Progressive Disclosure
- Essential info in 00-ESSENTIAL (read first, read always)
- Patterns in 02-PATTERNS (read when implementing)
- Lessons in 03-LESSONS (read when working on similar feature)
- Reference in 04-REFERENCE (read when need deep details)

### Prioritized Navigation
- Numbered folders guide reading order (00 to 01 to 02 to ...)
- Within files: ## H2 headers for major sections, ### H3 for details
- Cross-references link to specific sections: `[link](../file.md#section)`

## Usage Protocol

### MANDATORY Reading Protocol

**At the START of EVERY conversation (before responding to user):**
1. Read the full Project Context System (all files in context/)
2. If the user's request relates to topics with "see [filename]" links, read those too
3. Treat this as your persistent memory - you are the "same lead dev returning to work each day"
4. Treat this as the source of truth for project state and constraints

**When beginning ANY planned step or phase (new feature, job, phase of work):**
1. Read the full Project Context System again before proceeding (do not rely on earlier read)
2. Explicitly consider Recent Changes, Decisions, and Anti-Patterns for relevance
3. Apply them - skipping this causes repeated mistakes

**Re-read discipline:**
- If you have not re-read the full Project Context System within the last 20 user messages, do so immediately before continuing

**When proposing implementation or design:**
- Cite relevant Decisions or Anti-Patterns that apply (e.g., "Per the Redis caching pattern in batch-editors.md, we...")
- If implementing something that conflicts with established patterns, alert the user first

### Updating the Project Context System

**Batch at meaningful milestones** - Do not offer updates after every small change. Offer at:
- Phase/milestone completion
- Major decision or design closure
- Session wrap-up
- Clear break points

**Capture what has "stuck"** - Include only durable changes:
- Decisions made
- Designs agreed
- Implementations completed
- Accomplishments

**Exclude ephemeral work**:
- One-off questions (tooling, env setup)
- Code changes superseded during debugging
- Temporary debugging steps (unless they reveal patterns)
- Information already covered in existing files
- Speculative future plans without implementation

**Manual update triggers** - When user says ANY of these phrases:
- "update context"
- "update context"
- "wrap up"
- "done for today"
- "end session"

You MUST perform these steps:
1. Review conversation for durable items (decisions, patterns, anti-patterns, trade-offs, current work status)
2. If substantial update (logical break point, long gap since last update, or user requested thorough account):
   - First give user a summary of what you will add/change and which sections
   - Wait for confirmation before proceeding
3. Update appropriate files in context/
4. Confirm to user: list what was added, which sections updated, what next session will see

**DO NOT update without explicit user approval**

**How to update:**
```
1. Update 00-ESSENTIAL/active-work.md (current state)
2. Add/update relevant pattern in 02-PATTERNS/
3. Add lessons learned to 03-LESSONS/ if feature-specific
4. Keep updates concise and actionable
5. Add timestamp (YYYY-MM-DD) to new entries
6. If you add, remove, or rename a notable Project Context file, sync the index triad (see Maintenance below)
```

## Style Guidelines

**No emojis**: Use plain text instead (e.g., "Complete" not checkmarks, "Next" not hourglasses, "-" or "to" not arrows)

### Decision Documentation Template

For architectural decisions, include:
- **What** was decided
- **When** it was decided (date)
- **Why** this approach (rationale)
- **What alternatives** were considered and rejected
- **Key implications** or constraints

Example:
```markdown
### Redis for Batch Editor Caching (2025-11-17)

We use Redis for caching batch editor datasets (>1000 rows).

**Why?** sessionStorage quota (10MB) insufficient for Item dataset (15.32MB).

**Alternatives considered:**
- sessionStorage: Rejected - quota exceeded
- IndexedDB: Rejected - complexity, async overhead
- Backend pagination: Rejected - breaks filter/export operations

**Trade-off accepted:** Redis dependency in exchange for unlimited dataset size
```

## Deep Dive Files

Create files in `04-REFERENCE/` subfolders ONLY when:
- Topic is stable and won't change frequently
- Content would exceed 200 lines
- It's self-contained enough to be referenced separately
- User approves creating the separate file

Link from main files with: "For details, see 04-REFERENCE/[subfolder]/topic.md"

**Default to keeping everything in main pattern/lesson files** - avoid creating deep-dives prematurely.

## Maintenance

### Human review of this system (quarterly, or before major releases)

The agent protocol above keeps **LLM** behavior consistent. **People** (PM, tech lead) should occasionally confirm the docs still match reality:

- **`00-ESSENTIAL/active-work.md`** still reflects current priority and production constraints.
- **`01-ARCHITECTURE/preservation.md`** and **`security.md`** still match how permissions, APIs, and staff-facing surfaces actually behave in code and deploy.
- **`04-REFERENCE/api-docs/endpoint-catalog.md`** still matches public vs internal exposure.
- **`05-ARCHIVE/*`** remains clearly labeled *historical*; promote or correct anything that has become current truth.

This is a **short** audit, not a rewrite. If the truth in code or deploy has drifted from a file here, **update the Markdown** (or add a short note in `05-ARCHIVE/` when the story is truly historical). Deep implementation detail belongs in the **repository code**; these files are constraints, patterns, and decisions—not a second codebase.

### Index triad (keep in sync)

Three files replace an external “migration map.” When you **add, remove, or rename** any **notable** Markdown file under `context/` (new lesson, new `04-REFERENCE/` deep dive, new `05-ARCHIVE/` snapshot, or a renamed path), update **all that apply** in the same change set (or same PR):

| File | Role |
|------|------|
| `00-ESSENTIAL/system-inventory.md` | Folder roles, “major files by concern,” coverage self-check—reflect new entry points readers should know. |
| `00-ESSENTIAL/context-map.md` | Topic → path table for **every** navigable doc you expect people to open by name. |
| `05-ARCHIVE/where-patterns-live.md` | Topic area → **which pattern file** to extend when adding implementation standards (frontend, backend, batch, map/geo). |

**Rules of thumb:** New **pattern** or standard → extend the right `02-PATTERNS/*.md` and add or adjust a row in `where-patterns-live.md`. New **top-level doc** (e.g. new reference or archive file) → add a row to `context-map.md` and, if it is a primary entry point, mention it in `system-inventory.md` (“Major files” or folder description). Renames → update all three plus any in-file links across the tree.

Each of those three files starts with a short **cross-link block** to the other two and this section.

### File Growth Management

**When any file exceeds ~500 lines:**
1. Alert the user that the file is growing large
2. Propose moving stable/historical content to 05-ARCHIVE/ or splitting into focused files
3. Keep only "active, frequently-referenced" knowledge in main files
4. Maintain links from main files to archived content
5. Wait for user approval before executing the split

### Version History
- **2026-05-24 (field removal):** Removed `Item.permission_to_publish_online` from model, API, and UI; migration 0105; documented in `deprecated.md` and `active-work.md`
- **2026-05-24 (frontend split, phase 2):** Moved form, React conventions, and app-shell patterns to `04-REFERENCE/frontend/`; `frontend.md` now core patterns only (~350 lines)
- **2026-05-24 (frontend split):** Moved stable list-page patterns from `02-PATTERNS/frontend.md` (~1,097 lines) to `04-REFERENCE/frontend/list-page-patterns.md`; index triad updated
- **2026-04-23 (index triad):** Documented **Maintenance → Index triad** so `system-inventory.md`, `context-map.md`, and `where-patterns-live.md` stay in sync when adding or renaming Project Context files; cross-links at top of each file; `How to update` step 6
- **2026-04-23**: Added `00-ESSENTIAL/system-inventory.md` and `05-ARCHIVE/where-patterns-live.md`; file intros now cite only **this tree** or the **application codebase**; removed redundant top-level notes that duplicated the README
- **v3.1 (2026-04-23)**: Filled in architecture, workflows, product summary, API catalog, `05-ARCHIVE` snapshots, and multiselect lesson; added human **Maintenance** review guidance; institutional commitments in `cultural-context.md`
- **v3.0 (2026-03-14)**: Numbered folder layout, streamlined protocol, Markdown as the only format in this tree
- **v2.5 (2025-11-17)**: Item batch editor complete, filter persistence added
- **v2.0 (2025-11-08)**: Collaborator harmonization, dialect decommissioning
- **v1.0 (2025-01-04)**: Initial file-based project context

### File Lifecycle
- Active patterns stay in 02-PATTERNS/
- Completed feature lessons move to 03-LESSONS/
- Deprecated patterns move to 05-ARCHIVE/deprecated.md
- Review and prune quarterly

## Search Tips

**Find by topic:** Use your file search tool to grep for keywords
```
pattern: "Redis caching"        - 02-PATTERNS/batch-editors.md
pattern: "CollaboratorRole"     - 03-LESSONS/item-batch-editor.md
pattern: "usePersistedListState" - 04-REFERENCE/frontend/list-page-patterns.md
pattern: "ColumnVisibilityMenu"     - 04-REFERENCE/frontend/list-page-patterns.md
```

**Find by file:** Use glob patterns
```
"**/batch*.md"     - All batch editor files
"**/active*.md"    - Active work file
"**/frontend*.md"  - Frontend patterns
```

## Protocol Violations to Avoid

**DO NOT:**
- Create documentation files outside context/ folder
- Add parallel Project Context material as JSON (or any non-Markdown) in this tree—these documents are **Markdown only**
- Skip reading the full Project Context System at conversation start
- Update the Project Context System without user approval
- Include emojis in Project Context System files
- Update after every small change (batch at milestones)
- Skip re-reading before beginning new phases of work
- Proceed without citing relevant patterns when they apply

**If you find yourself doing any of these, self-correct immediately.**

---

**Project Context System** - Optimized for efficiency and maintainability
