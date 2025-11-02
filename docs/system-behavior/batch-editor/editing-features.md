# Editing Features

**Last Updated:** November 2, 2025

---

## Overview

The batch editor provides sophisticated editing capabilities including undo/redo, row selection, copy/paste, and validation. These features work together to support efficient bulk data editing while maintaining data integrity.

---

## Undo/Redo System

### Capabilities

- **Single cell edits:** Each cell change is one undo action
- **Batch operations:** Multi-cell paste operations are atomic (single undo)
- **History limit:** Max 50 actions (memory management)
- **Clears on save:** History resets after successful save (clean slate)

### Keyboard Shortcuts

- **Undo:** `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac)
- **Redo:** `Ctrl+Y` (Windows/Linux) or `Cmd+Shift+Z` (Mac)

### UI Controls

- **Undo button:** Toolbar button (grayed out if no history)
- **Redo button:** Toolbar button (grayed out if no redo stack)
- **Tooltip:** Hover shows keyboard shortcut

### Implementation

**Redux State:**
```typescript
undoStack: HistoryEntry[];  // Max 50 entries
redoStack: HistoryEntry[];  // Cleared when new action performed
```

**History Entry:**
```typescript
interface HistoryEntry {
  type: 'single' | 'batch';
  changes: CellChange[];       // Array of cell changes
  timestamp: number;
  description: string;         // e.g., "Edit Name" or "Paste 50 cells"
}

interface CellChange {
  rowId: string | number;
  fieldName: string;
  oldValue: any;
  oldText: string;
  newValue: any;
  newText: string;
  oldValidationState?: ValidationState;
  oldValidationError?: string;
}
```

**Actions:**
- `undo()` - Pop from undoStack, revert changes, push to redoStack
- `redo()` - Pop from redoStack, reapply changes, push to undoStack
- `clearHistory()` - Empty both stacks (after save)

### Behavior

**Single Cell Edit:**
1. User edits cell
2. `updateCell` action records old/new values in undoStack
3. If undoStack > 50, remove oldest entry
4. Clear redoStack (new changes invalidate redo)

**Batch Paste:**
1. User pastes 50 cells
2. `batchUpdateCells` action records all 50 changes as single HistoryEntry
3. One undo reverts all 50 cells

**After Save:**
1. Successful save clears both stacks
2. Rationale: Saved data is the new baseline, can't undo to unsaved state

**After Conflict:**
1. Conflicts DON'T clear history
2. User can undo conflict resolution and try different approach

---

## Row Selection System

### Capabilities

- **Individual selection:** Click checkbox to toggle single row
- **Select all:** Header checkbox selects/deselects all rows
- **Range selection:** Shift+click selects continuous range
- **Visual highlight:** Selected rows have light blue background
- **Integration with save:** Save only selected rows (or confirm save all)

### UI Components

#### Checkbox Column
- **Position:** Leftmost column (before row numbers)
- **Width:** 40px (non-resizable)
- **Header:** Master "select all" checkbox with indeterminate state
- **Cells:** Individual row checkboxes

#### Header Checkbox States
- **Unchecked (☐):** No rows selected
- **Indeterminate (⊟):** Some (but not all) rows selected
- **Checked (☑):** All rows selected

### Interaction Patterns

**Single Row Selection:**
```
1. User clicks checkbox on row 5
2. Row 5 marked as selected (isSelected: true)
3. Row 5 background turns light blue
4. Toolbar shows "1 selected"
```

**Range Selection (Shift+Click):**
```
1. User clicks checkbox on row 5
2. User holds Shift and clicks checkbox on row 10
3. Rows 5-10 all marked as selected
4. All rows 5-10 turn light blue
5. Toolbar shows "6 selected"
```

**Select All:**
```
1. User clicks header checkbox (unchecked)
2. All rows marked as selected
3. All rows turn light blue
4. Header checkbox changes to checked
5. Toolbar shows "1000 selected"
```

**Indeterminate State:**
```
1. Some rows selected (e.g., 3 out of 1000)
2. Header checkbox shows indeterminate (half-filled square)
3. Clicking header checkbox selects all (overrides partial selection)
```

### Visual Styling

**Selected Row:**
```css
background-color: #e3f2fd;  /* Light blue */
```

**Selected Row (Hover):**
```css
background-color: #bbdefb;  /* Darker blue */
```

### Integration with Save

**Selected Rows with Changes:**
- Toolbar shows: "3 selected (2 with changes)"
- Save button saves only the 2 rows with changes
- Other selected rows (no changes) are ignored

**No Selection:**
- Save button triggers confirmation dialog
- Dialog: "No rows are currently selected. Do you want to save all X changed row(s)?"
- User can cancel or confirm "Save All"

**After Save:**
- All checkboxes clear automatically (visual feedback for success)
- Selection state resets

---

## Copy/Paste System

### Capabilities

- **Single cell copy/paste:** Copy one cell, paste to one cell
- **Range copy/paste:** Copy multiple cells, paste as block
- **Fill behavior:** Copy one cell, paste to range (fills all cells with same value)
- **TSV format:** Compatible with Excel, Google Sheets, and other spreadsheet apps
- **Type-aware parsing:** Automatically parses booleans, decimals, arrays based on target cell type

### Keyboard Shortcuts

- **Copy:** `Ctrl+C` (Windows/Linux) or `Cmd+C` (Mac)
- **Paste:** `Ctrl+V` (Windows/Linux) or `Cmd+V` (Mac)

### Copy Behavior

**Single Cell:**
- Copies `cell.text` to clipboard as plain text
- Example: "Proto-Algonquian (algo1255)"

**Range (Multiple Cells):**
- Serializes to TSV (Tab-Separated Values) format
- Rows separated by newlines (`\n`)
- Columns separated by tabs (`\t`)
- Example:
  ```
  Language A	family	abcd1234
  Language B	language	efgh5678
  Language C	dialect	ijkl9012
  ```

### Paste Behavior

**Single Cell → Single Cell:**
```
1. User copies "family" from level column
2. User selects different cell in level column
3. Ctrl+V
4. Pasted cell receives "family"
5. Client-side validation checks format
6. Backend validation confirms choice is valid
```

**Single Cell → Range (Fill):**
```
1. User copies "family"
2. User selects range (e.g., 10 cells via Shift+click)
3. Ctrl+V
4. All 10 cells filled with "family"
5. Recorded as single batch undo action
```

**Range → Range:**
```
1. User selects 3x3 grid in Excel
2. Ctrl+C
3. User selects top-left cell in batch editor
4. Ctrl+V
5. 3x3 block pasted
6. TSV data parsed row-by-row, cell-by-cell
7. Each cell validated according to its type
8. Recorded as single batch undo action
```

### Type-Aware Parsing

**Text:**
- Pasted as-is

**Decimal:**
- Validates numeric format
- Rejects non-numeric input (cell turns red)

**Select:**
- Checks against `choices` array
- Must match a valid option
- Invalid input → red cell

**Relationship / MultiSelect:**
- Pasted text stored as `text`
- `value` set to `null` (ID unknown)
- Cell marked as "valid" (needs backend resolution)
- Backend attempts to resolve text → ID during save

**StringArray:**
- Parses comma-separated values
- Example: `"name1, name2, name3"` → `["name1", "name2", "name3"]`
- Also accepts JSON array format

**Boolean:**
- Accepts various formats:
  - `"true"` / `"false"` → `true` / `false`
  - `"yes"` / `"no"` → `true` / `false` (case-insensitive)
  - `"1"` / `"0"` → `true` / `false`

**Readonly:**
- Paste ignored (no-op)

### Special Cases

**Pasting Outside Grid:**
- If paste range exceeds available rows, extra data is ignored
- No auto-creation of new rows

**Pasting Invalid Data:**
- Invalid cells turn red immediately (client-side validation)
- User can undo, edit, or save anyway (backend will reject)

---

## Validation System

### Validation Levels

#### 1. **Client-Side Validation** (Immediate)

**When:** Immediately after cell edit or paste
**Purpose:** Fast feedback, prevent obvious errors
**Checks:**
- **Type checking:** Is value correct type? (number for decimal, etc.)
- **Format checking:** Is value in correct format? (array, boolean, etc.)
- **Required fields:** Is required field empty?
- **Choice matching:** For select types, is value in choices?

**Visual Feedback:**
- ❌ **Red cell:** Invalid (fails client-side validation)
- ✏️ **Yellow cell:** Edited (passes client-side validation)

#### 2. **Backend Validation** (Async, after client-side passes)

**When:** After client-side validation passes (200-300ms debounce)
**Purpose:** Deep validation (uniqueness, foreign keys, business rules)
**Checks:**
- **Uniqueness:** Is glottocode unique?
- **Foreign key validity:** Does parent_languoid ID exist?
- **Business rules:** Can this languoid have this parent?
- **Conflict detection:** Was field edited by another user concurrently?

**Visual Feedback:**
- ✅ **No highlight:** Valid (passes all validation)
- ❌ **Red cell:** Invalid (backend rejected)
- 🟧 **Orange cell:** Conflict (another user edited same field)

### Validation States

```typescript
type ValidationState = 'none' | 'valid' | 'invalid';
```

**none:** Not yet validated (initial state)
**valid:** Passed validation (client-side and/or backend)
**invalid:** Failed validation

### Visual Indicators

**Cell Background Colors:**
```css
/* Invalid (red) */
background-color: #ffebee;
border: 2px solid #f44336;

/* Edited/Valid (yellow) */
background-color: #fff9c4;

/* Conflict (orange) */
background-color: #ffe0b2;
border: 2px solid #ff9800;
```

**Error Messages:**
- Hover over red cell to see `validationError` tooltip
- Example: "This glottocode already exists"

### Conflict Detection (Optimistic Locking)

**Problem:** Two users edit same row concurrently
- Tab 1 edits `name` field
- Tab 2 edits `level` field
- Both save
- Without conflict detection: Last save wins, data loss occurs

**Solution:** Field-level conflict detection
- Each row has `_updated` timestamp from database
- On save, backend compares client's timestamp with current DB timestamp
- If different, backend checks which specific fields were edited by both users
- Only conflicted fields are rejected, other fields save successfully

**User Experience:**
```
1. Tab 1 edits "name" to "Language X"
2. Tab 2 edits "name" to "Language Y" (same row)
3. Tab 1 saves (succeeds)
4. Tab 2 saves (conflict detected)
5. Tab 2's "name" cell turns orange (conflict)
6. Error message: "1 row(s) were modified by another user. 1 field(s) have conflicts..."
7. User reviews conflict, decides to overwrite or undo
8. User saves again (overwrites DB value)
```

**Non-Conflicting Fields Save:**
```
1. Tab 1 edits "name"
2. Tab 2 edits "level" (different field, same row)
3. Tab 1 saves (succeeds)
4. Tab 2 saves
5. "name" field has conflict (rejected)
6. "level" field has no conflict (saved successfully)
7. Row reloads with Tab 1's "name" and Tab 2's "level"
```

---

## Keyboard Navigation

### Arrow Keys
- **Up/Down:** Navigate between rows
- **Left/Right:** Navigate between columns
- **Auto-scroll:** Selected cell always visible

### Tab Key
- **Tab:** Move to next cell (right, then down to next row)
- **Shift+Tab:** Move to previous cell (left, then up to previous row)

### Home/End Keys
- **Home:** Jump to first column in current row
- **End:** Jump to last column in current row

### Enter Key
- **Enter (view mode):** Open editor for selected cell
- **Enter (edit mode):** Commit changes and close editor

### Escape Key
- **Escape (edit mode):** Cancel changes and close editor

---

## Future Enhancements

### Planned Features

1. **Inline editing:** Edit text/decimal cells without modal (faster)
2. **Drag-to-fill:** Excel-like drag corner to fill down
3. **Find and replace:** Bulk text replacement across cells
4. **Conditional formatting:** Color cells based on rules
5. **Column filtering:** Filter rows by column values
6. **Column sorting:** Sort rows by column (client-side)
7. **Bulk validation:** Validate all cells with one click

### Under Consideration

1. **Collaborative editing:** Real-time multi-user editing with live cursors
2. **Comment system:** Add comments to cells for review
3. **Audit trail:** View edit history per cell
4. **Macros/Scripts:** Automate repetitive edits
5. **Import/Export:** CSV/Excel import with column mapping

---

**For architecture details, see [Architecture](architecture.md).**

