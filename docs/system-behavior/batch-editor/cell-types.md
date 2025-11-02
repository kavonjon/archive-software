# Cell Types

**Last Updated:** November 2, 2025

---

## Overview

The batch editor supports 8 cell types, each with a specialized editor and validation logic. Cell types are defined in column configuration and determine how data is displayed, edited, and validated.

---

## Supported Cell Types

### 1. **text**

**Purpose:** Simple text input for short strings

**Display:** Plain text
**Editor:** Single-line text input (Material-UI TextField)
**Value Type:** `string`
**Validation:** Max length (optional), required check

**Example Usage:**
- Name fields
- Short descriptions
- Codes (e.g., glottocodes)

**Editor Behavior:**
- Opens on double-click or Enter
- Cursor positioned at end of text
- Commits on blur or Enter
- Cancels on Escape

---

### 2. **decimal**

**Purpose:** Numeric input for integers and floats

**Display:** Formatted number
**Editor:** Numeric text input (Material-UI TextField with `type="number"`)
**Value Type:** `number`
**Validation:** Numeric format, range checks (optional)

**Example Usage:**
- Coordinates (latitude, longitude)
- Counts
- Measurements

**Editor Behavior:**
- Validates numeric format on commit
- Rejects non-numeric input
- Supports negative numbers and decimals

---

### 3. **select**

**Purpose:** Single choice from predefined options

**Display:** Human-readable label (e.g., "Language")
**Editor:** Dropdown menu (Material-UI Select with MenuItems)
**Value Type:** `string` (machine-readable value, e.g., "language")
**Validation:** Must match one of the predefined choices

**Column Config:**
```typescript
{
  fieldName: 'level_glottolog',
  cellType: 'select',
  choices: [
    { value: 'family', label: 'Family' },
    { value: 'language', label: 'Language' },
    { value: 'dialect', label: 'Dialect' },
  ]
}
```

**Editor Behavior:**
- Dropdown opens immediately
- Click option to select and commit
- Escape closes without change
- Clicking away commits selected value

---

### 4. **relationship**

**Purpose:** Foreign key reference to another model (Many-to-One)

**Display:** Related object's display text (e.g., "Proto-Algonquian (algo1255)")
**Editor:** Autocomplete with API search (Material-UI Autocomplete)
**Value Type:** `number | null` (foreign key ID)
**Validation:** Must match valid ID from API or be null

**Column Config:**
```typescript
{
  fieldName: 'parent_languoid',
  cellType: 'relationship',
  relationshipConfig: {
    apiEndpoint: '/api/languoids/search/',
    displayFormat: (obj) => `${obj.name} (${obj.glottocode})`,
  }
}
```

**Editor Behavior:**
- Search input with debounced API calls (300ms)
- Shows dropdown with matching results
- Arrow keys navigate options
- Enter selects highlighted option
- Clear button (×) to remove relationship
- Clicking away commits current selection
- Supports keyboard navigation (up/down arrows, Enter)

**Paste Behavior:**
- Pasted text stored as `text`, `value` set to `null`
- Cell marked as "valid" (needs API resolution later)
- Backend resolves text → ID during save

---

### 5. **multiselect**

**Purpose:** Many-to-Many relationship (multiple selections)

**Display:** Comma-separated list (e.g., "Algic (algi1248), Iroquoian (iroq1247)")
**Editor:** Chip-based UI with autocomplete (Material-UI Chips + Autocomplete)
**Value Type:** `number[]` (array of foreign key IDs)
**Validation:** All IDs must be valid

**Column Config:**
```typescript
{
  fieldName: 'language_families',
  cellType: 'multiselect',
  relationshipConfig: {
    apiEndpoint: '/api/languoids/search/',
    displayFormat: (obj) => `${obj.name} (${obj.glottocode})`,
  }
}
```

**Editor Behavior:**
- Search input with debounced API calls
- Selected items shown as chips above input
- Click chip × to remove
- Add multiple items without closing editor
- Editor stays open until clicking away or Escape
- Commits all changes on blur

**Paste Behavior:**
- Similar to relationship: text stored, IDs resolved later

---

### 6. **stringarray**

**Purpose:** Array of text strings (not foreign keys)

**Display:** Comma-separated list (e.g., "Choctaw, Chahta, Chacta")
**Editor:** Chip-based UI for adding/removing strings
**Value Type:** `string[]`
**Validation:** Array format, optional max items

**Example Usage:**
- Alternate names
- Tags
- Keywords

**Editor Behavior:**
- Type text and press Enter to add chip
- Click chip × to remove
- Comma-separated input also supported
- Commits on blur

**Paste Behavior:**
- Parses comma-separated or JSON array format
- Example: `"name1, name2, name3"` → `["name1", "name2", "name3"]`

---

### 7. **boolean**

**Purpose:** Three-state boolean (Yes/No/Not specified)

**Display:** "Yes", "No", or "(empty)"
**Editor:** Dropdown with 3 options (Material-UI Select)
**Value Type:** `boolean | null`
**Validation:** Must be `true`, `false`, or `null`

**Editor Behavior:**
- Dropdown with options: "Yes", "No", "Not specified"
- Selecting an option commits immediately and closes editor
- Escape cancels

**Paste Behavior:**
- Accepts various boolean formats:
  - `"true"`, `"false"` (strings)
  - `"yes"`, `"no"` (case-insensitive)
  - `"1"`, `"0"` (numeric strings)
  - `true`, `false` (JSON boolean)

---

### 8. **readonly**

**Purpose:** Display-only fields (e.g., ID, auto-generated fields)

**Display:** Grayed-out text with special styling
**Editor:** None (double-click and Enter are ignored)
**Value Type:** Any (display-only)
**Validation:** None

**Example Usage:**
- Database IDs
- Auto-calculated fields
- System timestamps

**Visual Styling:**
- Gray background (`#f5f5f5`)
- Gray text (`#9e9e9e`)
- Italic font style
- Cursor changes to `not-allowed` on hover

---

## Cell Type Selection Guide

| Use Case | Cell Type | Notes |
|----------|-----------|-------|
| Short text | `text` | Max length < 255 chars |
| Long text | `text` | Consider textarea variant in future |
| Numbers | `decimal` | Supports int and float |
| Fixed choices | `select` | Predefined list of options |
| Foreign key (1) | `relationship` | Many-to-One, autocomplete search |
| Foreign keys (N) | `multiselect` | Many-to-Many, chip UI |
| List of strings | `stringarray` | Not foreign keys, just text |
| Yes/No/Unknown | `boolean` | Three-state dropdown |
| Auto-generated | `readonly` | No editing allowed |

---

## Implementation Details

### Cell Type Definition

**File:** `frontend/src/types/spreadsheet.ts`

```typescript
export type CellType = 
  | 'text'
  | 'decimal'
  | 'select'
  | 'relationship'
  | 'multiselect'
  | 'stringarray'
  | 'boolean'
  | 'readonly';
```

### Column Configuration

**File:** Model-specific wrapper (e.g., `LanguoidBatchEditor.tsx`)

```typescript
const LANGUOID_COLUMNS: ColumnConfig[] = [
  {
    fieldName: 'name',
    label: 'Name',
    width: 200,
    cellType: 'text',
    required: true,
  },
  {
    fieldName: 'level_glottolog',
    label: 'Level',
    width: 120,
    cellType: 'select',
    choices: [
      { value: 'family', label: 'Family' },
      { value: 'language', label: 'Language' },
      { value: 'dialect', label: 'Dialect' },
    ],
    required: true,
  },
  {
    fieldName: 'parent_languoid',
    label: 'Parent Languoid',
    width: 250,
    cellType: 'relationship',
    relationshipConfig: {
      apiEndpoint: '/api/languoids/search/',
      displayFormat: (obj) => `${obj.name} (${obj.glottocode})`,
    },
  },
  // ... more columns
];
```

### Editor Routing

**File:** `frontend/src/components/batch/CellEditor.tsx`

```typescript
const CellEditor: React.FC<CellEditorProps> = ({ cell, column, onCommit, onCancel }) => {
  if (cell.type === 'text') {
    return <TextField ... />;
  }
  if (cell.type === 'decimal') {
    return <TextField type="number" ... />;
  }
  if (cell.type === 'select') {
    return <Select ...><MenuItem ...>...</Select>;
  }
  if (cell.type === 'relationship') {
    return <Autocomplete ... />;
  }
  if (cell.type === 'multiselect') {
    return <Autocomplete multiple renderTags={(value, getTagProps) => ...} />;
  }
  if (cell.type === 'stringarray') {
    return <ChipInput ... />;
  }
  if (cell.type === 'boolean') {
    return <Select ...><MenuItem value={true}>Yes</MenuItem>...</Select>;
  }
  if (cell.type === 'readonly') {
    return null; // No editor
  }
};
```

### Display Rendering

**File:** `frontend/src/components/batch/MemoizedSpreadsheetCell.tsx`

```typescript
const renderCellContent = () => {
  if (cellType === 'readonly') {
    return <span style={{ fontStyle: 'italic', color: '#9e9e9e' }}>{cell.text}</span>;
  }
  // All other types: just display cell.text
  return <span>{cell.text}</span>;
};
```

---

## Copy/Paste Behavior by Type

| Cell Type | Copied Format | Paste Parsing |
|-----------|---------------|---------------|
| `text` | Plain text | Plain text |
| `decimal` | Plain number | Numeric validation |
| `select` | Machine value | Must match choices |
| `relationship` | Display text | Store as text, resolve later |
| `multiselect` | Display text | Store as text, resolve later |
| `stringarray` | Comma-separated | Parse comma or JSON array |
| `boolean` | "Yes"/"No"/"" | Parse various formats |
| `readonly` | Display text | Paste ignored |

---

## Future Enhancements

### Potential New Cell Types

1. **date** - Date picker with validation
2. **datetime** - Date + time picker
3. **email** - Text with email format validation
4. **url** - Text with URL format validation
5. **textarea** - Multi-line text input for long content
6. **markdown** - Rich text editor for formatted content
7. **json** - Code editor for structured data
8. **file** - File upload widget

### Enhancement Ideas

1. **Inline editing:** Edit simple types (text, decimal) directly in cell without modal
2. **Conditional formatting:** Change cell color based on value
3. **Cell formulas:** Excel-like calculations
4. **Cell templates:** Reusable cell type configurations

---

**For editor implementation details, see [Architecture](architecture.md).**

