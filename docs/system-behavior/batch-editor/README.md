# Batch Editor System

**Last Updated:** November 2, 2025  
**Purpose:** Overview of the batch editor subsystem for bulk data editing  
**Audience:** Developers maintaining or extending the batch editor

---

## Overview

The batch editor is a spreadsheet-like interface for bulk editing of database records. It supports complex data types, validation, undo/redo, and handles datasets of 10,000+ rows with smooth performance.

**Primary Use Case:** Languoid batch editing (languages and dialects)

---

## Architecture

- **Built with:** TanStack Table (virtualized) + Redux state management
- **Replaced:** ReactGrid (performance limitations with 10,000+ rows)
- **Key Innovation:** Row virtualization enables smooth scrolling with massive datasets

See **[architecture.md](architecture.md)** for detailed component hierarchy and state management.

---

## Documentation Index

### Core Technical Documentation

- **[Architecture](architecture.md)** - Component hierarchy, state management, why TanStack
- **[Cell Types](cell-types.md)** - All supported cell types and their editors
- **[Editing Features](editing-features.md)** - Undo/redo, selection, copy/paste, validation
- **[Performance](performance.md)** - Virtualization, memoization, benchmarks, limitations

---

## Quick Reference

### Key Files
- **Core Components:** `frontend/src/components/batch/`
  - `TanStackSpreadsheet.tsx` - Core virtualized table
  - `MemoizedSpreadsheetCell.tsx` - Optimized cell rendering
  - `CellEditor.tsx` - Modal editor for complex types
  - `TanStackSpreadsheetWrapper.tsx` - Toolbar + grid wrapper
- **State Management:** `frontend/src/store/batchSpreadsheetSlice.ts`
- **Model Integration:** `frontend/src/components/languoids/LanguoidBatchEditor.tsx`

### Key Concepts
- **Virtualization:** Only visible rows are rendered (~20-30 at a time)
- **Memoization:** Cells re-render only when their data changes
- **Atomic Operations:** Undo/redo treats batch pastes as single actions
- **Field-Level Conflicts:** Optimistic locking prevents concurrent edit data loss

### Performance Targets (10,000 rows)
- Scroll: 60 FPS
- Cell edit: < 100ms
- Selection toggle: < 50ms
- Undo/redo: < 100ms

---

## Related Documentation

- **[ADR: TanStack Migration](../adr-tanstack-migration.md)** - Architecture Decision Record for migration
- **[System Behavior](../system-behavior.md)** - Other system internals (Languoid signals, etc.)

---

## Contributing

When extending the batch editor:

1. **Cell Types:** Add new editor in `CellEditor.tsx`, update type unions in `spreadsheet.ts`
2. **Features:** Consider performance impact (avoid breaking virtualization)
3. **State:** Use Redux for persistent state, local state only for transient UI
4. **Testing:** Test with 10,000 rows to verify performance
5. **Documentation:** Update relevant file in this directory

---

**For architectural decisions and historical context, see the [ADR](../adr-tanstack-migration.md).**

