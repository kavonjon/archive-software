# Keyboard Shortcuts

The Batch Editor supports comprehensive keyboard navigation for efficient data entry.

## Navigation

| Key | Action |
|-----|--------|
| **Arrow keys** (↑ ↓ ← →) | Navigate between cells |
| **Tab** | Move to next cell (right, then down) |
| **Shift+Tab** | Move to previous cell (left, then up) |
| **Home** | Jump to first column in current row |
| **End** | Jump to last column in current row |
| **Page Up** | Scroll up one screen |
| **Page Down** | Scroll down one screen |

## Editing

| Key | Action |
|-----|--------|
| **Enter** | Open editor for selected cell |
| **Enter** (in editor) | Save changes and close editor |
| **Escape** | Cancel changes and close editor |
| **Double-click** | Open editor for cell |
| **F2** | Open editor (alternative to Enter) |

## Cell Operations

| Key (Windows/Linux) | Key (Mac) | Action |
|---------------------|-----------|--------|
| **Delete** | **Fn+Delete** | Clear selected cell(s) |
| **Backspace** | **Delete** | *(Disabled - data protection)* |
| **Ctrl+C** | **Cmd+C** | Copy selected cell(s) |
| **Ctrl+V** | **Cmd+V** | Paste into selected cell(s) |
| **Ctrl+X** | **Cmd+X** | Cut selected cell(s) |

## Undo/Redo

| Key (Windows/Linux) | Key (Mac) | Action |
|---------------------|-----------|--------|
| **Ctrl+Z** | **Cmd+Z** | Undo last change |
| **Ctrl+Y** | **Cmd+Y** | Redo last undone change |
| **Ctrl+Shift+Z** | **Cmd+Shift+Z** | Redo (alternative) |

## Selection

| Key | Action |
|-----|--------|
| **Shift+Arrow** | Extend selection in direction |
| **Shift+Click** | Extend selection to clicked cell |
| **Ctrl+A** / **Cmd+A** | Select all cells |
| **Click and drag** | Select range with mouse |

## Cell Type-Specific Shortcuts

### Select Fields (Dropdown)
- **Arrow keys** - Navigate options
- **Enter** - Select highlighted option
- **Escape** - Close dropdown without selecting
- **Type to filter** - Narrow down options

### Relationship Fields (Autocomplete)
- **Arrow keys** - Navigate suggestions
- **Enter** - Select highlighted suggestion
- **Escape** - Close suggestions
- **Type to search** - Filter by name or glottocode

### MultiSelect Fields (Chips)
- **Type and Enter** - Add new chip
- **Backspace** (in search) - Remove last chip
- **Click X on chip** - Remove specific chip

### String Array Fields (Chips)
- **Type comma** - Separate items
- **Enter** - Commit all items
- **Backspace** - Remove chips

### Boolean Fields
- **Arrow keys** - Navigate options (Yes/No/Not specified)
- **Enter** - Select option

## Tips

### Efficient Data Entry
1. **Tab through cells** - Fastest way to fill in a row
2. **Enter, edit, Enter** - Quick edit without mouse
3. **Arrow keys** - Navigate without leaving keyboard

### Bulk Operations
1. **Select range** - Shift+Arrow or click-drag
2. **Delete (Fn+Delete)** - Clear all at once
3. **Paste** - Fill range from clipboard

### Keyboard-Only Workflow
- Use **Tab** and **Arrow keys** for navigation
- Use **Enter** to edit, **Enter** again to save
- Use **Delete (Fn+Delete)** to clear unwanted values
- Use **Ctrl+Z (Cmd+Z)** to undo mistakes
- Never touch the mouse!

### Data Protection
**Backspace** is disabled when not in edit mode:
- Prevents accidental data deletion
- Must use **Delete (Fn+Delete)** key to clear cells
- Once in edit mode, Backspace works normally for text editing

### Auto-Scroll
- Selected cell automatically scrolls into view
- Useful when navigating large datasets
- Works with keyboard and mouse selection

## Platform Differences

### Mac vs Windows/Linux

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Copy | Ctrl+C | Cmd+C |
| Paste | Ctrl+V | Cmd+V |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Y |
| Clear cell | Delete | Fn+Delete |

