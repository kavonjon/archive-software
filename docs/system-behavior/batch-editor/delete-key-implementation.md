# Delete Key Implementation - Clear Cells Without Edit Mode

## Overview
Implementation of keyboard shortcuts for clearing cell contents without entering edit mode, following Excel/Google Sheets conventions with added data protection.

**Implementation Date**: 2025-11-02  
**Feature**: Delete key clears cells, Backspace is ignored (protection)

---

## Behavior

### Delete Key (Cross-Platform)
**Key**: `Delete` (Windows Delete, Mac Fn+Delete)

**Action**: Clears cell content without entering edit mode

**Behavior**:
- ✅ **Single cell**: Clears the selected cell
- ✅ **Range selection**: Clears all cells in the selected range
- ✅ **Respects readonly cells**: Skips cells marked as readonly
- ✅ **Type-aware clearing**: Uses appropriate empty value based on cell type
- ✅ **Undo/redo support**: Single cell = single undo entry, range = batch undo entry
- ✅ **Validation trigger**: Cleared cells are validated (required fields may turn red)

**Empty Values by Cell Type**:
```typescript
text:         null  (empty string display)
decimal:      null  (empty string display)
select:       null  (empty string display)
relationship: null  (empty string display)
multiselect:  []    (empty array)
stringarray:  []    (empty array)
boolean:      null  ("Not specified")
readonly:     [skipped - not cleared]
```

### Backspace Key (Protection)
**Key**: `Backspace` (Windows Backspace, Mac Delete key)

**Action**: **Does nothing** when not in edit mode

**Rationale**:
- ✅ Protects against accidental data loss
- ✅ Users must intentionally use Delete key
- ✅ Backspace still works normally during edit mode (deletes characters)

---

## Cross-Platform Considerations

### Windows/PC
- **Delete key**: ✅ Clears cell (as expected)
- **Backspace key**: ❌ Does nothing (protection)

### macOS
- **Fn+Delete** (forward delete): ✅ Clears cell (requires 2 keys - more intentional)
- **Delete key** (labeled "delete", actually backspace): ❌ Does nothing (protection)

**Mac User Note**: 
Mac users must use **Fn+Delete** (two keys) to clear cells. This is:
- More intentional (aligns with data protection goal)
- Consistent with Windows Delete key behavior
- The same key code (`e.key === 'Delete'`)

---

## Implementation Details

### Code Location
**File**: `frontend/src/components/batch/TanStackSpreadsheet.tsx`  
**Lines**: 656-742 (in `handleKeyDown` effect)

### Key Detection
```typescript
if (e.key === 'Delete') {
  // Cross-platform: Windows Delete, Mac Fn+Delete
  // Clears cell(s)
}

if (e.key === 'Backspace') {
  // Cross-platform: Windows Backspace, Mac Delete key
  // Does nothing (protection)
  e.preventDefault();
  return;
}
```

### Range Selection Support
When a range is selected:
1. Calculates min/max row and column indices
2. Iterates through all cells in the range
3. Skips readonly cells
4. Applies changes as a batch operation
5. Stores in undo stack as single atomic operation

### Single vs Batch Changes
```typescript
if (changes.length === 1) {
  // Single cell - use regular cell change (updateCell reducer)
  onCellChange(rowId, fieldName, newValue, newText);
} else {
  // Multiple cells - use batch change (batchUpdateCells reducer)
  onBatchCellChange(changes, `Clear ${changes.length} cells`);
}
```

**Why this matters**:
- Single cell: Normal undo/redo (one Ctrl+Z undoes one cell)
- Batch: Atomic undo/redo (one Ctrl+Z undoes entire range)

---

## Examples

### Example 1: Clear Single Cell
```
User actions:
1. Click on cell B3 (contains "English")
2. Press Delete

Result:
- Cell B3 is now empty (null value, empty text)
- Cell remains selected
- Not in edit mode
- Change tracked for save (yellow background if edited)
- Undo stack: "Clear 1 cells"
```

### Example 2: Clear Range
```
User actions:
1. Click on cell A1
2. Shift+Click on cell C5 (selects 3x5 = 15 cells)
3. Press Delete

Result:
- All 15 cells cleared (readonly cells skipped)
- Range selection remains active
- Not in edit mode
- Undo stack: "Clear 15 cells" (single undo entry)
```

### Example 3: Clear with Readonly Cells
```
Setup: Column A is "ID" (readonly), Column B is "Name" (editable)
User actions:
1. Select range A1:B5 (10 cells total)
2. Press Delete

Result:
- 5 cells in Column A skipped (readonly)
- 5 cells in Column B cleared
- Undo stack: "Clear 5 cells"
```

### Example 4: Clear Required Field
```
Setup: "Name" field is required
User actions:
1. Select cell containing "Test Language"
2. Press Delete

Result:
- Cell cleared (empty)
- Cell turns RED immediately (required field validation)
- Error message: "Name is required."
- Row.hasErrors = true
- Save button will show validation error dialog if attempted
```

### Example 5: Backspace Protection (No Action)
```
User actions:
1. Click on cell B3 (contains "English")
2. Press Backspace

Result:
- Nothing happens (cell still contains "English")
- Cell remains selected
- Not in edit mode
- No change tracked
```

---

## Comparison with Industry Standards

### Excel
| Key | Windows | Mac | Our Implementation |
|-----|---------|-----|-------------------|
| Delete | ✅ Clear cell | ✅ Clear cell (Fn+Delete) | ✅ Clear cell |
| Backspace | ✅ Clear + edit mode | ✅ Clear + edit mode | ❌ Does nothing |

**Difference**: We intentionally block Backspace for data protection.

### Google Sheets
| Key | Windows | Mac | Our Implementation |
|-----|---------|-----|-------------------|
| Delete | ✅ Clear cell | ✅ Clear cell (Fn+Delete) | ✅ Clear cell |
| Backspace | ✅ Clear + edit mode | ✅ Clear + edit mode | ❌ Does nothing |

**Difference**: We intentionally block Backspace for data protection.

---

## Design Rationale

### Why Block Backspace?

**User Goal**: "Protect data from careless user action"

**Reasoning**:
1. ✅ **Intentionality**: Delete key is more deliberate than Backspace
2. ✅ **Muscle memory**: Users habitually press Backspace while reading/thinking
3. ✅ **Reduced accidents**: Forcing Delete key reduces unintended clears
4. ✅ **Clear mental model**: "Delete = remove, Backspace = edit backwards"

**Trade-off**:
- ⚠️ Differs from Excel/Sheets (which allow Backspace)
- ⚠️ Mac users must use two keys (Fn+Delete)
- ✅ Aligns with project's data integrity goals

### Why Not Use Ctrl+Delete or Cmd+Delete?

**Rejected**: Requiring modifier keys (Ctrl/Cmd) would:
- ❌ Reduce productivity (extra key required)
- ❌ Violate user expectations from Excel/Sheets
- ❌ Frustrate experienced spreadsheet users

**Conclusion**: Single Delete key is the right balance of protection and efficiency.

---

## Integration with Other Features

### Undo/Redo
- ✅ Single cell clear: One undo entry
- ✅ Range clear: One batch undo entry
- ✅ Ctrl+Z restores cleared values
- ✅ Ctrl+Y re-clears values

### Validation
- ✅ Cleared cells trigger validation
- ✅ Required fields turn red when cleared
- ✅ `row.hasErrors` updated automatically
- ✅ Save operation blocked if cleared required fields

### Copy/Paste
- ✅ Can copy empty cells
- ✅ Pasting over cleared cells works normally
- ✅ Empty clipboard paste clears cells (same as Delete)

### Selection
- ✅ Works with single cell selection
- ✅ Works with range selection (Shift+Click, Shift+Arrow)
- ✅ Selection remains active after clearing

---

## Testing

### Test 1: Clear Single Cell
1. Click on a cell with content
2. Press Delete (Windows) or Fn+Delete (Mac)
3. **Expected**: Cell is empty, still selected, not in edit mode

### Test 2: Clear Range
1. Select a range of cells (Shift+Click)
2. Press Delete
3. **Expected**: All cells in range cleared, range selection remains

### Test 3: Readonly Cell Protection
1. Select the "ID" column cell (readonly)
2. Press Delete
3. **Expected**: Nothing happens (readonly cells not cleared)

### Test 4: Backspace Does Nothing
1. Click on a cell with content
2. Press Backspace (Windows) or Delete key (Mac)
3. **Expected**: Nothing happens, cell content unchanged

### Test 5: Required Field Turns Red
1. Select a cell in "Name" column (required)
2. Press Delete
3. **Expected**: Cell cleared, turns RED, error message appears

### Test 6: Undo Cleared Cell
1. Clear a cell (Delete key)
2. Press Ctrl+Z (Windows) or Cmd+Z (Mac)
3. **Expected**: Cell content restored

### Test 7: Clear Range Undo
1. Select and clear 10 cells
2. Press Ctrl+Z
3. **Expected**: All 10 cells restored in one undo operation

---

## Known Limitations

### Mac Two-Key Requirement
**Limitation**: Mac users must use Fn+Delete (two keys) to clear cells.

**Workaround**: None - this is intentional for data protection.

**Future Enhancement**: Could add a user preference toggle to allow Mac's Delete key (backspace) to clear cells.

---

## Future Enhancements (Not Implemented)

### 1. Confirmation for Large Range Clears
**Idea**: If user selects > 50 cells and presses Delete, show confirmation dialog:
```
"Clear 127 cells? This action can be undone."
[Cancel] [Clear]
```

### 2. User Preference Toggle
**Idea**: Settings option to enable Backspace for clearing:
```
☐ Allow Backspace key to clear cells (less data protection)
```

### 3. Smart Empty Values
**Idea**: When clearing a cell, remember what type it was and suggest appropriate value:
- Select field → Clear to first choice (not null)
- Decimal field → Clear to 0 (not null)

---

## Related Documentation
- [Keyboard Navigation](./keyboard-navigation.md)
- [Copy/Paste System](./copy-paste.md)
- [Validation System](./validation.md)
- [Undo/Redo](./undo-redo.md)

