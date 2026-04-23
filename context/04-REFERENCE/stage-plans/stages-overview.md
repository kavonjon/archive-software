# Development Stages Overview

**Five-stage development approach** with Stage 0 as foundation

---

## Stage Sequence

### Stage 0: React Migration (Complete)

**Goal**: Migrate from Django templates to modern React SPA

**Status**: Complete (2025-01-04)

**Achievements**:
- Separated frontend/backend architecture
- React 18 + TypeScript + Material-UI
- Full CRUD for all core models (Items, Collections, Collaborators, Languoids)
- Hot reload development workflow
- ADA compliance built-in

**Foundation For**: All subsequent stages

---

### Stage 1: Batch Editing (In Progress - 3 of 4)

**Goal**: Efficient bulk editing with spreadsheet interface

**Strategic Value**: Immediate daily value for museum staff workflows

**Status**: 3 of 4 complete
- Complete: Languoid batch editor (1,200 rows)
- Complete: Collaborator batch editor (7,400 rows)
- Complete: Item batch editor (4,400 rows) - State-of-the-art
- Next: Document batch editor - **NEXT PRIORITY**

**Key Features**:
- In-browser spreadsheet interface (TanStack Table)
- Import/export XLSX with round-trip support
- Live validation and error feedback
- Invalid data preservation (visual correction)
- Undo/redo (50 actions)
- Redis caching for performance
- Async exports for large datasets

**Timeline**: Near completion (Document is final)

**Detailed Plan**: `stage-1-batch-editing.md`

---

### Stage 2: Repository Management (Planned)

**Goal**: Document to File transition, true ingestion system

**Scope**:
- Replace Document model with File model (~100,000 document migration required)
- File format detection and metadata extraction
- Master file + derivative generation (transcoding)
- Virus scanning integration
- Storage organization (physical + logical separation)
- Checksums (SHA-256) and integrity verification
- Batch file ingestion workflows

**Key Technical Decisions**:
- **tus.io** for resumable file uploads (supports files >1TB, critical for audio/video archives)
- **SHA-256** checksums for file integrity (used in cross-server sync and deduplication)
- Streaming download architecture (files too large for memory-buffered download)

**Dependencies**: Stage 1 complete

**Strategic Value**: Transform from catalog system to true digital repository

**Status**: Comprehensive planning document exists (`stage-2-5.md`)

---

### Stage 3: Public/Private Infrastructure (Planned)

**Goal**: Enable public access while maintaining private server

**Scope**:
- Dual-server architecture (already partially implemented)
- Cross-server file synchronization
- Database synchronization strategies
- Public-facing search and browse interfaces
- Access control for sensitive materials
- Virus scanning (re-scan on sync)

**Dependencies**: Stage 2 complete (File model exists)

**Strategic Value**: Public access to appropriate materials

**Status**: Comprehensive planning document exists (`stage-2-5.md`)

---

### Stage 4: Miscellaneous Improvements (Planned)

**Goal**: Enhance existing functionality

**Scope**:
- Advanced search capabilities
- Reporting and analytics
- Data quality tools
- Bulk operations beyond batch editing
- UI/UX refinements
- Performance optimizations

**Known Backlog Items**:
- Replace `django-video-encoding` library (current version has maintenance issues)
- Multi-file upload UI update (required due to Django 5 FileInput API changes)
- Endpoint classification cleanup (resolve duplicate internal/public languoid paths)
- Temporary permissions cleanup (remove temporary kavon user migrate-view permissions)

**Dependencies**: None specific (can run parallel to other stages)

**Status**: Detail in `stage-2-5.md`

---

### Stage 5: LTO Backup System (Planned)

**Goal**: Long-term archival storage on LTO tape

**Scope**:
- LTO tape management
- Automated backup workflows
- Restore procedures
- Integrity verification
- Retention policies

**Dependencies**: Stage 2 complete (File model)

**Strategic Value**: Long-term preservation compliance

**Status**: Outline in `stage-5-lto.md`; related pipeline notes in `stage-2-5.md`

---

## Current Focus

**Stage 1 - Document Batch Editor**

**Why Now**: Final batch editor, completes Stage 1

**Reference**: Item batch editor (most complete patterns)

**Expected**: Faster implementation (all patterns established)

**After Completion**: Move to Stage 2 planning/kickoff

---

## Stage Sequencing Rationale

**Stage 0 First**: Modern UI foundation required for all future work

**Stage 1 Second**: Immediate staff value, builds muscle with React + Django patterns

**Stage 2 Third**: Core functionality improvement, foundation for Stage 3

**Stage 3 Fourth**: Requires Stage 2 File model, enables public access

**Stages 4-5 Parallel**: Can be worked on as needed, not strictly sequential

---

**See also**:
- `stage-1-batch-editing.md` - Current stage details
- `../00-ESSENTIAL/active-work.md` - Current priorities
