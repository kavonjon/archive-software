# Quickstart Guide

**Goal**: Get oriented and productive in 5 minutes.

## What Is This Project?

**Native American Languages (NAL) Archive** - Digital repository management system operated by the **Sam Noble Oklahoma Museum of Natural History** at the **University of Oklahoma**.

**Mission**: Supporting Native communities and researchers in language revitalization and cultural preservation.

**Cultural Note**: Cultural considerations are paramount in all technical decisions affecting data access and visibility. See `../01-ARCHITECTURE/cultural-context.md` for detailed cultural sensitivity requirements.

**Refactors / legacy UI:** Before changing models, `/django/` templates, or public API shapes, read `../01-ARCHITECTURE/preservation.md`.

**Archive Management System** for a museum's Native American language materials:
- **4,400+ Items** (recordings, texts, videos, books)
- **7,400+ Collaborators** (speakers, authors, translators)
- **1,200+ Languoids** (languages and dialects in hierarchical tree)
- **Multiple Collections** (ACH, CAR, NAL, etc.)

**Current Focus**: Stage 1 - Batch Editing interfaces for efficient cataloging workflows

## Tech Stack

**Backend** (Python 3.11):
- Django 4.2 + Django REST Framework
- PostgreSQL database
- Celery (async tasks) + Redis (broker, caching)
- Group-based permissions (no direct auth tokens)

**Frontend** (React 18):
- TypeScript + Material-UI
- TanStack Table (for batch editors)
- Separated architecture (localhost:3000 to localhost:8000)

## Development Workflow

```bash
# Terminal 1: Backend + Celery
./dev.sh

# Terminal 2: Frontend
cd frontend && npm start

# Access:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000/internal/v1/
# - Django Admin: http://localhost:8000/admin/
```

**If Celery not reloading code:**
```bash
pkill -9 -f 'celery -A archive'
./dev.sh
```

## Current State (2026-03-14)

### Stage 1: Batch Editing (3 of 4 Complete)
- Complete: **Languoid** batch editor (1200 rows, 40 fields) - Production
- Complete: **Collaborator** batch editor (7400 rows, 35 fields) - Production  
- Complete: **Item** batch editor (4400 rows, 61 fields) - **STATE-OF-THE-ART** reference
- Next: **Document** batch editor - **NEXT TASK**

### Recent Wins
- Filter persistence across navigation (Item list page)
- Fixed batch edit/export filtered (697 item count discrepancy)
- Backend validate_field fix for DecimalField import (lat/lng)
- Navigation menu reordered (Collections before Items)

## Core Concepts

### Batch Editors
**Why?** Staff need to edit 100s of catalog records efficiently.

**Pattern**: Spreadsheet interface in browser with:
- Redis caching (15-20s build, <1s cached)
- Live validation, field-specific editors
- Import/export XLSX (human-readable format)
- Invalid data preservation (show red, allow correction)

**Current Reference**: Item batch editor (most complete)
- 61 fields including complex through-models
- Custom editors: CollaboratorRoles (through-model), TitleWithLanguage (text+FK)
- Invalid data preservation with visual feedback

### Data Model Overview

**Item** (catalog entry):
- 61 fields (catalog_number, description, dates, etc.)
- M2M: Languages, Collaborators (via CollaboratorRole through-model)
- Through-models: ItemTitle (titles with language), CollaboratorRole (roles + citation flag)
- Computed: browse_categories (auto from genre/type), collection (auto from catalog prefix)

**Collaborator** (person):
- Name components (first_names, nickname, last_names, suffix) - computed full_name
- M2M: native_languages, other_languages (auto-adds parent for dialects)
- Through-model: CollaboratorRole (M2M to Item)

**Languoid** (language/dialect):
- Hierarchical tree: Family - Language - Dialect
- Computed: level_nal, family_languoid, hierarchy FKs (via signals + Celery)
- M2M: cached descendents (for performance)

**Collection** (organizational grouping):
- Auto-assigned to Items via catalog_number prefix (e.g., "ACH-123" - ACH collection)

### Permissions
Three Django Groups (explicit assignment required):
- **Archivist**: View, edit, delete (full access)
- **Museum Staff**: View, edit (no delete)
- **Read-Only**: View only

No group = 403 Forbidden (must be explicitly assigned)

## Where to Go Next

**Implementing Document batch editor?**
1. Read `../03-LESSONS/item-batch-editor.md` (comprehensive patterns)
2. Read `../02-PATTERNS/batch-editors.md` (6 universal patterns)
3. Review `frontend/src/components/items/ItemBatchEditor.tsx` (reference code)

**Fixing a bug?**
1. Check `active-work.md` for known issues
2. Search `02-PATTERNS/` for relevant patterns
3. Compare with working implementation (Collaborator or Item)

**Adding a feature?**
1. Find similar feature in codebase
2. Check `02-PATTERNS/` for established patterns
3. Follow same structure and naming conventions

## Critical Rules

**Accessibility**: All UI must be ADA compliant (semantic HTML, ARIA, keyboard nav)

**No component-in-component**: Never define components inside components (causes cursor jumping)

**Backend validation**: Virtual fields (SerializerMethodField) can't be validated via API - validate in parser

**Redis caching**: Mandatory for batch editors with >1000 rows (implement from start)

**Field names**: Keep TypeScript interfaces in sync with Django serializer field names

**Logging**: Remove debug logging after debugging complete (keep only essential logs)

**End-user documentation**: Documentation in `docs/user-guide/` and `docs/system-behavior/` is **PM-triggered only**. Never create user-facing docs proactively. In-app help is rendered via ReactMarkdown + `remark-gfm`.

**Stack compliance**: Work with MUI/React/Django conventions, not against them. If you think you need to fight a framework pattern, discuss with the team first. Bypassing framework conventions creates subtle bugs and maintenance burden.

**Commit discipline**: Changes must be tested in the browser and ADA-verified before committing. User should approve significant changes before they are committed.

---

**Next**: Read `active-work.md` for current tasks and priorities
