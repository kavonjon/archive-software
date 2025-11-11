# Batch Editing Collaborators

The Collaborator Batch Editor provides a spreadsheet-style interface for efficiently editing multiple collaborator records at once. This section covers collaborator-specific features and workflows.

## Overview

The batch editor allows you to:
- Edit multiple collaborators simultaneously in a spreadsheet view
- Import collaborators from Excel/CSV files
- Copy and paste data between rows
- Apply bulk changes with validation
- Save selected rows or all changes at once

For general batch editor features (keyboard shortcuts, copy/paste, validation), see the **Batch Editor Overview** section.

## Batch-Specific Features for Collaborators

### Alphabetical Display

Collaborators in the batch editor are displayed in **alphabetical order by last name**:
- Sorts by Last Name(s) field
- Makes it easy to find and edit related individuals

### Full Name Calculation

The **Full Name** column is **read-only** and **automatically calculated**:
- Cannot be edited directly in the batch editor
- Updates automatically when you change:
  - First Name(s)
  - Nickname
  - Last Name(s)
  - Name Suffix
- Format: `first_names "nickname" last_names name_suffix`

**Example**:
- If you edit First Name(s) to "Jane" and Last Name(s) to "Doe"
- Full Name automatically becomes "Jane Doe"
- If you add Nickname "JJ", Full Name becomes 'Jane "JJ" Doe'

### Structured List Editing: Other Names

The **Other Names** column uses a special editor for structured lists:
- Click the cell to open the list editor
- Type a name and press Enter to add
- Click X on a name to remove it
- Each name is stored as a separate item (not comma-separated)
- Copy/paste works between rows

**Why Structured Lists Matter**:
- Each alternative name is indexed separately for searching
- Names can contain commas, quotes, or special characters without issues
- System can query "Does collaborator have alternative name X?" precisely

### Language Relationship Fields

Both **Native/First Languages** and **Other Languages** columns allow multiple language selections:
- Click cell to open autocomplete search
- Type to search by language name or glottocode
- Select multiple languages
- Each language shows as "Name (glottocode)"
- Copy/paste works between rows

### Privacy: Anonymous Field

The **Anonymous** column controls whether identifying information is obscured in public contexts:
- Values: True, False, or Not specified
- When **True**: Public displays may show "Anonymous Collaborator"
- When **False** or **Not specified**: Full information shown publicly
- **Important**: Internal archive views always show full details regardless of this setting

## Importing Collaborator Spreadsheets

When importing Excel or CSV files into the Collaborator Batch Editor, the system recognizes specific columns and handles collaborator-specific data intelligently.

### Recognized Spreadsheet Columns

The importer looks for these columns (case-insensitive, whitespace-flexible):

**Editable Columns** (used by batch editor):
- `Collaborator ID` (auto-generated if not provided for new rows)
- `Full Name` (ignored - calculated from components)
- `First Name(s)`
- `Last Name(s)`
- `Nickname`
- `Name Suffix`
- `Other Names` (can be comma-separated in spreadsheet; system splits into list)
- `Gender`
- `Clan/Society` (also recognizes `Clan Society`)
- `Origin`
- `Tribal Affiliations`
- `Native/First Languages` (comma-separated glottocodes or names)
- `Other Languages` (comma-separated glottocodes or names)
- `Birthdate`
- `Deathdate`
- `Anonymous` (True/False)
- `Other Info`

**Ignored Columns** (calculated or system-managed):
- `Full Name` - Always calculated from First, Nickname, Last, Suffix
- `Slug` - System-generated identifier
- `UUID` - System-generated identifier
- `Added`, `Updated`, `Modified By` - Timestamp and user tracking

Any other columns in your spreadsheet are simply ignored.

### Auto-Generated Collaborator IDs

**For New Collaborators:**
- If your spreadsheet includes a row that doesn't match an existing collaborator in the database
- The system **ignores** any `Collaborator ID` provided in the spreadsheet
- A new, unique `Collaborator ID` is **automatically generated**
- This prevents ID conflicts and ensures uniqueness

**For Existing Collaborators:**
- If the `Collaborator ID` in your spreadsheet matches an existing collaborator
- The system loads that collaborator and applies your changes

**Multiple New Collaborators:**
- When importing multiple new rows at once
- Each gets a sequentially incrementing `Collaborator ID`
- The system calculates the next available ID and increments for each new row

**Example**:
```
Spreadsheet has:
  Row 1: Collaborator ID: 100 (exists in DB) → Updates existing collaborator #100
  Row 2: Collaborator ID: 999 (doesn't exist) → Creates NEW, ID auto-assigned as 7573
  Row 3: Collaborator ID: blank → Creates NEW, ID auto-assigned as 7574
```

### Name Component Import

When importing name data, you can use either approach:

**Option 1: Component Fields (Recommended)**
```
First Name(s) | Nickname | Last Name(s) | Name Suffix
Jane          | JJ       | Doe          | Jr.
```
- System uses these to calculate Full Name
- Most flexible and searchable

**Option 2: Full Name Only (Not Recommended)**
```
Full Name
Jane "JJ" Doe Jr.
```
- System **ignores** this column
- You must provide First Name(s) and/or Last Name(s) for the name to import
- Full Name will be recalculated from components

**Best Practice**: Always provide First Name(s) and Last Name(s) in separate columns. The system will calculate Full Name automatically.

### Other Names Import

The **Other Names** column can be imported in two formats:

**Comma-Separated (in spreadsheet)**:
```
Other Names
Maria Sanchez, María Sánchez, ᎹᎵᎠ
```
- System automatically splits by comma
- Each name becomes a separate list item

**Already Structured (from previous export)**:
```
Other Names
["Maria Sanchez", "María Sánchez", "ᎹᎵᎠ"]
```
- System recognizes JSON array format
- Imports directly as structured list

Both formats work seamlessly.

### Language Import

For **Native/First Languages** and **Other Languages** columns:

**Comma-Separated Glottocodes**:
```
Native/First Languages
zapa1253, zapa1254
```

**Comma-Separated Names**:
```
Native/First Languages
Záparo, Arabela
```

**Mixed Format**:
```
Native/First Languages
Záparo (zapa1253), zapa1254
```

The system looks up each language and establishes the relationship. If a language doesn't exist, you'll see a validation error.

### Updating Existing Collaborators

If your spreadsheet contains Collaborator IDs that match existing database records:

- The system **automatically loads** the existing collaborator
- **Applies changes** from your spreadsheet (only modified fields)
- Row appears in the editor with changed cells marked **yellow**
- Checkbox is **automatically checked** for easy saving

**Workflow**:
1. Export collaborators from the system
2. Edit in Excel/Google Sheets
3. Save as .xlsx or .csv
4. Import back into batch editor
5. Review changes (yellow cells)
6. Save to update records

This makes the "export → edit → import" workflow seamless for bulk updates.

## Common Batch Editing Tasks

### Adding Multiple New Collaborators

1. Open an empty batch editor (click "Batch Edit" with no rows selected)
2. Click **"Add Row"** for each collaborator you want to create
3. Fill in name fields for each:
   - First Name(s)
   - Last Name(s)
   - Nickname (optional)
   - Name Suffix (optional)
4. Notice Full Name calculates automatically
5. Fill in optional fields (origin, languages, dates)
6. Check all new rows
7. Click **"Save"**

### Bulk Updating a Field

1. Select collaborators from the list page
2. Open batch editor
3. Select the column you want to update
4. Edit one cell with the new value
5. Copy that cell (Ctrl+C / Cmd+C)
6. Select all other cells in that column you want to update
7. Paste (Ctrl+V / Cmd+V)
8. Check the affected rows
9. Click **"Save"**

### Importing a Collaborator List

1. Prepare a spreadsheet with collaborators:
   - Columns: First Name(s), Last Name(s), and any other fields
   - One row per collaborator
   - Use comma-separated values for Other Names and Languages
2. Import the spreadsheet (drag & drop or upload button)
3. Review imported rows (new rows auto-checked)
4. Verify calculated Full Names are correct
5. Check for validation errors (red cells)
6. Click **"Save"**

### Standardizing Name Format

If collaborators have inconsistent name formatting:

1. Select collaborators that need standardization
2. Open batch editor
3. For each row, distribute Full Name into components:
   - Copy first name portion to First Name(s) column
   - Copy last name portion to Last Name(s) column
   - Copy nickname to Nickname column (if present)
   - Copy suffix to Name Suffix column (if present)
4. Full Name recalculates automatically in standard format
5. Check affected rows
6. Click **"Save"**

### Adding Languages to Multiple Collaborators

If several collaborators speak the same languages:

1. Select relevant collaborators
2. Open batch editor
3. Edit **Native/First Languages** for one collaborator
4. Add the language(s)
5. Copy that cell
6. Select the same column cells for other rows
7. Paste
8. Check affected rows
9. Save

### Bulk Adding Alternative Names

1. Open batch editor with collaborators needing alternative names
2. Edit **Other Names** column (list editor)
3. Type name and press Enter to add
4. Copy/paste between rows if names are similar
5. Check affected rows
6. Save

### Managing Anonymous Status

To mark multiple collaborators as anonymous:

1. Select collaborators on list page
2. Open batch editor
3. Edit **Anonymous** column to **True** for each
4. Or edit one cell, copy, paste to others
5. Check affected rows
6. Save

**Warning**: Consult with archive administration before bulk-changing anonymity status, especially when removing anonymous flags.

## Validation in Batch Mode

### Real-Time Validation

As you edit cells, validation runs immediately:
- **Red cells** - Invalid data (must fix before saving)
- **Orange cells** - Warnings or conflicts (review required)
- **Yellow cells** - Edited but valid (unsaved changes)
- **Blue cells** - Validation in progress

### Common Validation Errors

**"Collaborator ID must be unique"**
- Another collaborator already has this ID
- Fix: Don't manually set IDs for new collaborators (let system auto-assign)

**"Language not found"**
- A glottocode or language name in Native/Other Languages doesn't exist
- Fix: Verify the language exists in the system or create it first

**"Invalid date format"**
- Birthdate or Deathdate couldn't be parsed
- Fix: Use formats like "YYYY-MM-DD", "Month YYYY", or "circa YYYY"

**"Full Name cannot be edited directly"** (orange warning)
- You attempted to edit the Full Name field
- Fix: Edit First Name(s), Nickname, Last Name(s), or Name Suffix instead

### Conflict Detection

If another user edits the same collaborator while you're working:
- **Orange cells** indicate conflicts
- Click cell to see what changed in the database
- Options:
  - Accept your version (edit the cell, cell turns yellow)
  - Accept database version (don't edit, cell stays orange then cleared on refresh)
- Opening a conflicting cell for edit marks the conflict as "reviewed"

### Fixing Validation Errors

1. Red or orange cells block saving (or show warnings)
2. Click the cell to see the error message in a tooltip
3. Fix the value
4. Cell turns yellow (valid) or white (unchanged)
5. Try saving again

## Performance with Large Datasets

The batch editor uses virtualization to handle large datasets efficiently:
- **Up to 10,000 rows** supported
- Only visible rows are rendered (smooth scrolling)
- All editing features work with large datasets
- Validation may take a few seconds for bulk operations (spinner cursor shows progress)

**Tips for Large Datasets**:
- Use filters on the list page to load only relevant collaborators
- Save in batches (check 50-100 rows at a time)
- Use import for very large additions (more efficient than manual entry)

## Tips for Efficient Batch Editing

1. **Use export as a template** - Export existing collaborators, modify in Excel, re-import
2. **Let Full Name calculate** - Never manually edit Full Name; edit components instead
3. **Use structured lists properly** - For Other Names, add each name as a separate item
4. **Copy/paste liberally** - Spread data across rows quickly
5. **Use checkboxes strategically** - Save only what you've verified
6. **Save frequently** - Don't lose work if validation fails on some rows
7. **Undo is your friend** - Ctrl+Z / Cmd+Z works for mistakes
8. **Respect privacy** - Review anonymous status changes carefully
9. **Use search on list page** - Load only the collaborators you need to edit

## Special Considerations

### Full Name is Read-Only

Unlike other fields, **Full Name cannot be edited** in the batch editor:
- Any changes to First, Nickname, Last, or Suffix will update Full Name automatically
- If you import a spreadsheet with Full Name values, they are ignored
- This ensures name consistency and proper searching/sorting

### Other Names are Structured

The **Other Names** field is not a simple text field:
- Each alternative name is a separate list item
- Comma-separated import is supported, but system stores as structured list
- When exporting, you'll see structured format (JSON array)
- This allows precise searching: "Does collaborator have exact alternative name 'X'?"

### Anonymous Status Impact

Setting **Anonymous = True** in batch mode:
- Takes effect immediately upon save
- Affects public displays but not internal views
- Consider reviewing with administration before bulk changes
- System logs these changes for audit purposes

## Transitioning from Single to Batch Editing

If you find yourself making the same change to many collaborators:
- Stop editing individually
- Select all affected collaborators on the list page
- Open batch editor
- Make the change once, copy/paste to others
- Save all at once

This saves significant time and reduces errors.

