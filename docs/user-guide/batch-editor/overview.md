# Batch Editor Overview

The Batch Editor is a powerful spreadsheet-style interface for editing multiple records at once. It provides Excel-like functionality with real-time validation and conflict detection.

## Key Features

### Spreadsheet Interface
- **Familiar spreadsheet UX** - Works like Excel or Google Sheets
- **Keyboard navigation** - Arrow keys, Tab, Home/End, Enter
- **Copy/paste** - Full support for single cells and ranges
- **Undo/redo** - Revert changes with Ctrl+Z / Ctrl+Y

### Data Validation
- **Real-time validation** - Immediate feedback on invalid data
- **Visual indicators**:
  - 🔴 **Red cells** - Invalid data (errors must be fixed)
  - 🟠 **Orange cells** - Conflicts or warnings (requires review)
  - 🟡 **Yellow cells** - Edited (unsaved changes)
  - ⚪ **White cells** - Unchanged

### Bulk Operations
- **Bulk import** - Upload Excel/CSV files directly into the editor
- **Bulk save** - Save multiple edited rows at once
- **Selection checkboxes** - Choose which rows to save

## Opening the Batch Editor

From any list view (Languoids, Items, Collaborators):

1. **Select rows** using checkboxes, or
2. **Apply filters** to narrow down records, then
3. Click **"Batch Edit"** button

You can also open an empty batch editor and import data from a spreadsheet.

## Basic Editing

### Edit a Single Cell
1. **Double-click** a cell, or
2. Select a cell and press **Enter**
3. Edit the value
4. Press **Enter** to save, or **Escape** to cancel

### Edit Multiple Cells
1. **Select cells** (click and drag, or Shift+arrow keys)
2. Press **Delete** to clear all selected cells
3. Or **paste** copied data to fill the selection

### Copy and Paste
- **Ctrl+C** (or Cmd+C on Mac) to copy
- **Ctrl+V** (or Cmd+V on Mac) to paste
- Works with single cells or ranges
- Preserves data types (foreign keys, arrays, etc.)

## Saving Changes

### Save Selected Rows
1. **Check the boxes** for rows you want to save
2. Click **"Save"** button
3. System will validate all checked rows
4. If validation passes, changes are saved

### Save All Rows
1. If no rows are checked, clicking **"Save"** will prompt you
2. Confirm to save all edited rows
3. Validation runs on all rows before saving

### Validation Errors
If rows have validation errors:
- A dialog will show which rows/fields have errors
- Fix the errors (cells will be highlighted in red)
- Try saving again

## Conflict Resolution

If someone else edited the same row while you were editing:
- Conflicting fields will turn **orange**
- A tooltip shows the current database value
- You can:
  - Edit the cell again to overwrite, or
  - Cancel your edit to keep the database value
- Non-conflicting fields in the same row save successfully

