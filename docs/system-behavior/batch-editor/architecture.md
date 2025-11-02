# Batch Editor Architecture

**Last Updated:** November 2, 2025

---

## Overview

The batch editor uses a headless table library (TanStack Table) with row virtualization to enable smooth performance with large datasets (10,000+ rows). State is managed through Redux Toolkit, and complex cell editors are built with Material-UI.

---

## Why TanStack Table? (Migration from ReactGrid)

### The Problem with ReactGrid
- **No virtualization:** Rendered all rows to DOM simultaneously
- **Out-of-memory errors:** Failed with 1,000+ rows
- **Performance degradation:** Slow scrolling, UI freezes with large datasets
- **Requirement:** System must handle 10,000+ rows smoothly

### TanStack Table Solution
- **Row virtualization:** Only renders visible rows (~20-30 at a time)
- **Headless architecture:** Full control over rendering and styling
- **Performance:** 60 FPS scrolling with 10,000 rows
- **Flexibility:** Easy to implement custom cell types and editors

---

## Component Hierarchy

```
LanguoidBatchEditor (model-specific)
  └─ AdaptiveSpreadsheetGrid (adapter interface)
      └─ TanStackSpreadsheetWrapper (toolbar + grid container)
          └─ TanStackSpreadsheet (core virtualized table)
              └─ MemoizedSpreadsheetCell (optimized cell rendering)
                  └─ CellEditor (modal editor for complex types)
```

### Component Responsibilities

#### **TanStackSpreadsheet** (`TanStackSpreadsheet.tsx`)
- **Core virtualized table component**
- Responsibilities:
  - Render virtualized rows using `@tanstack/react-virtual`
  - Handle keyboard navigation (arrows, Tab, Home/End, Enter)
  - Manage cell selection state (single cell, range)
  - Handle mouse interactions (click, double-click, drag selection)
  - Trigger cell editing (double-click, Enter key)
  - Handle copy/paste (Ctrl+C, Ctrl+V with TSV format)
- **Props:** rows, columns, onCellChange, onBatchCellChange, onToggleRowSelection, etc.

#### **MemoizedSpreadsheetCell** (`MemoizedSpreadsheetCell.tsx`)
- **Optimized cell rendering with React.memo**
- Responsibilities:
  - Render individual cell based on type (text display, select label, relationship text, etc.)
  - Apply visual styling (validation state, edited state, selection highlighting)
  - Prevent unnecessary re-renders using custom equality function
- **Optimization:** Only re-renders if cell value, text, or state actually changes

#### **CellEditor** (`CellEditor.tsx`)
- **Modal editor for complex cell types**
- Responsibilities:
  - Text input, decimal input, select dropdown
  - Relationship autocomplete with API search
  - MultiSelect chip-based UI with API search
  - StringArray chip-based UI
  - Boolean three-state dropdown
  - Readonly (no editor)
- **Lifecycle:** Opens on double-click/Enter, commits on blur/Enter, cancels on Escape

#### **TanStackSpreadsheetWrapper** (`TanStackSpreadsheetWrapper.tsx`)
- **Toolbar and grid container**
- Responsibilities:
  - Display toolbar with model name, row counts, selection status
  - Render action buttons (Undo, Redo, Add Row, Refresh, Save)
  - Show loading overlay during data fetching
  - Adapt interface between TanStackSpreadsheet and model wrappers

#### **AdaptiveSpreadsheetGrid** (`AdaptiveSpreadsheetGrid.tsx`)
- **Thin adapter layer** (future-proofing)
- Originally designed to switch between ReactGrid and TanStack
- Now exclusively uses TanStackSpreadsheetWrapper
- Could be removed in future refactoring

#### **LanguoidBatchEditor** (`LanguoidBatchEditor.tsx`)
- **Model-specific wrapper for Languoids**
- Responsibilities:
  - Define column configuration (LANGUOID_COLUMNS)
  - Load data from API
  - Handle cell changes (client-side validation, backend validation)
  - Implement save logic (batch save, conflict detection)
  - Manage undo/redo history
  - Handle selection and save integration

---

## State Management

### Redux Slice: `batchSpreadsheetSlice.ts`

#### State Shape
```typescript
interface BatchSpreadsheetState {
  modelName: string;                    // e.g., "languoid"
  rows: SpreadsheetRow[];               // Array of row data
  loading: boolean;                     // Data fetch in progress
  saving: boolean;                      // Save operation in progress
  error: string | null;                 // Error message
  successMessage: string | null;        // Success message
  validatingCells: string[];            // Cell IDs being validated
  undoStack: HistoryEntry[];            // Undo history (max 50)
  redoStack: HistoryEntry[];            // Redo history
  maxHistorySize: number;               // 50 actions
}
```

#### Row Structure
```typescript
interface SpreadsheetRow {
  id: string | number;                  // DB ID or "draft-{uuid}"
  cells: Record<string, SpreadsheetCell>; // Map of field name → cell
  isDraft: boolean;                     // True for new rows
  hasChanges: boolean;                  // True if any cell edited
  hasErrors: boolean;                   // True if validation errors
  isSelected?: boolean;                 // Checkbox selection state
  version?: number;                     // Optimistic locking version
  _updated?: string;                    // DB timestamp for conflicts
}
```

#### Cell Structure
```typescript
interface SpreadsheetCell {
  value: any;                           // Typed value (string, number, ID, array, etc.)
  text: string;                         // Human-readable display text
  type: CellType;                       // 'text', 'select', 'relationship', etc.
  isEdited: boolean;                    // True if user changed this cell
  originalValue: any;                   // Value from DB (for change detection)
  validationState: ValidationState;     // 'valid', 'invalid', 'none'
  validationError?: string;             // Error message if invalid
  hasConflict: boolean;                 // True if concurrent edit detected
  fieldName: string;                    // Model field name
  readOnly?: boolean;                   // True for ID fields
}
```

### Why Redux (Not Local State)?

1. **Centralized state:** Single source of truth for entire spreadsheet
2. **Complex operations:** Undo/redo, range selection, batch updates require global state
3. **Performance:** Immer (used by Redux Toolkit) preserves referential equality for unchanged objects
4. **Conflict detection:** Need to compare current state with DB state across components

### Redux Actions

**Data Management:**
- `initializeSpreadsheet({ modelName, rows })` - Load initial data
- `updateCell({ rowId, fieldName, cell })` - Update single cell (records undo history)
- `batchUpdateCells({ changes, description })` - Update multiple cells (atomic undo)
- `updateRowAfterSave({ oldId, newRow })` - Replace row after successful save
- `addDraftRow(row)` - Add new draft row

**Undo/Redo:**
- `undo()` - Revert last action
- `redo()` - Reapply last undone action
- `clearHistory()` - Clear undo/redo stacks (after save)

**Selection:**
- `toggleRowSelection(rowId)` - Toggle single row checkbox
- `toggleAllRowSelection()` - Select/deselect all rows
- `selectRowRange({ startId, endId })` - Shift+click range selection
- `clearAllSelections()` - Clear all checkboxes (after save)

**UI State:**
- `setLoading(boolean)` - Show/hide loading spinner
- `setSaving(boolean)` - Show/hide saving state
- `setError(string | null)` - Display error message
- `setSuccessMessage(string | null)` - Display success message
- `setValidating({ cellId, isValidating })` - Track validation in progress

---

## Performance Architecture

### 1. Row Virtualization
- **Library:** `@tanstack/react-virtual`
- **Mechanism:** Only renders rows within viewport + overscan buffer
- **Result:** 10,000 rows rendered as ~30 DOM elements
- **Benefit:** Constant rendering cost regardless of dataset size

### 2. Cell Memoization
- **Mechanism:** `React.memo` with custom `arePropsEqual` function
- **Logic:** Cell re-renders only if value, text, or state changes
- **Benefit:** Prevents cascading re-renders when editing unrelated cells

### 3. Event Handler Memoization
- **Mechanism:** `useCallback` for all event handlers
- **Benefit:** Prevents cell re-renders due to handler reference changes

### 4. Immer for Immutability
- **Mechanism:** Redux Toolkit uses Immer for state updates
- **Benefit:** "Mutating" syntax with structural sharing (unchanged objects keep same reference)
- **Result:** React's reconciliation efficiently skips unchanged subtrees

---

## Data Flow

### Cell Edit Flow
```
1. User double-clicks cell or presses Enter
   ↓
2. TanStackSpreadsheet sets editingCell state
   ↓
3. CellEditor renders appropriate editor for cell type
   ↓
4. User edits value and commits (blur, Enter, click away)
   ↓
5. CellEditor calls onCellCommit(newValue)
   ↓
6. TanStackSpreadsheet calls onCellChange(rowId, fieldName, newValue)
   ↓
7. LanguoidBatchEditor receives change
   ↓
8. Client-side validation (type checking, format, required fields)
   ↓
9. Dispatch updateCell (records undo history)
   ↓
10. Backend validation API call (async)
    ↓
11. Update validation state (valid/invalid/conflict)
```

### Save Flow
```
1. User clicks Save button
   ↓
2. Check if rows are selected via checkboxes
   ↓
3a. If selected: Filter to selected rows with changes
3b. If not selected: Show confirmation dialog for all changed rows
   ↓
4. Check for validation errors (hasErrors)
   ↓
5. Convert SpreadsheetRows to API format (only changed fields)
   ↓
6. Call languoidsAPI.saveBatch(rowsToSave)
   ↓
7. Backend validates and checks for conflicts (optimistic locking)
   ↓
8a. Success: Update rows with fresh DB data
8b. Conflict: Mark conflicted fields, preserve user edits
   ↓
9. Clear undo history and selections (if no conflicts)
```

---

## Technology Stack

### Core Libraries
- **TanStack Table v8** - Headless table library
- **@tanstack/react-virtual** - Row virtualization
- **Redux Toolkit** - State management
- **Material-UI v5** - Cell editors (TextField, Select, Autocomplete, Chip)
- **React 18** - UI framework

### Key Dependencies
- **Immer** - Immutable state updates (via Redux Toolkit)
- **uuid** - Generate draft row IDs

---

## File Organization

```
frontend/src/
├── components/
│   ├── batch/
│   │   ├── TanStackSpreadsheet.tsx         (core table)
│   │   ├── TanStackSpreadsheet.module.css  (styling)
│   │   ├── MemoizedSpreadsheetCell.tsx     (optimized cell)
│   │   ├── CellEditor.tsx                  (modal editor)
│   │   ├── TanStackSpreadsheetWrapper.tsx  (toolbar + grid)
│   │   ├── AdaptiveSpreadsheetGrid.tsx     (adapter)
│   │   └── index.ts                        (exports)
│   └── languoids/
│       └── LanguoidBatchEditor.tsx         (model wrapper)
├── store/
│   └── batchSpreadsheetSlice.ts            (Redux state)
└── types/
    └── spreadsheet.ts                       (TypeScript interfaces)
```

---

## Extension Points

### Adding a New Cell Type

1. **Add type to enum** (`types/spreadsheet.ts`):
   ```typescript
   export type CellType = '...' | 'yournewtype';
   ```

2. **Add editor** (`CellEditor.tsx`):
   ```typescript
   if (cell.type === 'yournewtype') {
     return <YourCustomEditor ... />;
   }
   ```

3. **Add display** (`MemoizedSpreadsheetCell.tsx`):
   ```typescript
   if (cellType === 'yournewtype') {
     return <span>{cell.text}</span>;
   }
   ```

4. **Add validation** (model wrapper):
   ```typescript
   if (column.cellType === 'yournewtype') {
     // Validate format
   }
   ```

### Adding a New Feature

1. **Redux action** (if global state needed)
2. **Component logic** (if UI-only)
3. **Performance testing** (verify no virtualization breakage)
4. **Documentation** (update relevant .md file)

---

**For implementation details of specific features, see:**
- [Cell Types](cell-types.md)
- [Editing Features](editing-features.md)
- [Performance](performance.md)

