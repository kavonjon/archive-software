# Batch Editing Languoids

The Languoid Batch Editor provides a spreadsheet-style interface for efficiently editing multiple languoid records at once. This section covers languoid-specific features and workflows.

## Overview

The batch editor allows you to:
- Edit multiple languoids simultaneously in a spreadsheet view
- Import languoids from Excel/CSV files
- Copy and paste data between rows
- Apply bulk changes with validation
- Save selected rows or all changes at once

For general batch editor features (keyboard shortcuts, copy/paste, validation), see the **Batch Editor Overview** section.

## Batch-Specific Features for Languoids

### Hierarchical Display

Languoids in the batch editor are displayed in **hierarchical tree order**:
- Families appear first
- All children appear below their parent
- Siblings are sorted alphabetically
- Each languoid's full ancestry is visible in context

This makes it easy to see relationships and edit related languoids together.

### Quick Parent Selection

The **Parent Languoid** column allows you to quickly establish relationships:
- Type to search by name or glottocode
- Results show "Name (glottocode)" format
- Select from dropdown with Enter
- Leave empty for families (no parent)

### Bulk Level Changes

You can quickly change the classification level of multiple languoids:
- Select the Level column cells for multiple rows
- Paste the new level (e.g., "Language", "Dialect")
- All selected rows update at once

### Mixed Hierarchies

The batch editor can display **families, languages, and dialects together**:
- Each row is a languoid (regardless of type)
- Level column shows the type
- Parent column shows the relationship
- Tree structure is maintained

This allows you to work with entire language families in one view.

## Importing Languoid Spreadsheets

When importing Excel or CSV files into the Languoid Batch Editor, the system recognizes specific columns and handles languoid-specific data intelligently.

### Recognized Spreadsheet Columns

The importer looks for these columns (case-insensitive, whitespace-flexible):

**Editable Columns** (used by batch editor):
- `Name` (required)
- `Name Abbreviation`
- `Glottocode` (required)
- `ISO 639-3`
- `Level (Glottolog)` (required - "Family", "Language", or "Dialect")
- `Parent Languoid Glottocode` ⚠️ **Important: Only glottocode is used**
- `Alternate Names`
- `Region`
- `Latitude`
- `Longitude`
- `Tribes`
- `Notes`

**Ignored Columns** (calculated/derivative fields):
- `Level (NAL)` - Calculated automatically
- `Parent Languoid` (name) - Ignored; only glottocode is used
- `Parent Languoid Abbreviation` - Ignored
- `Family`, `Family Abbreviation`, `Family Glottocode` - All calculated
- `Primary Subfamily`, `Secondary Subfamily` and their related fields - All calculated

Any other columns in your spreadsheet are simply ignored.

### Parent Languoid Association

**Critical Detail**: When specifying parent-child relationships in your spreadsheet:

- ✅ **Use the `Parent Languoid Glottocode` column**
- ❌ **Do NOT use `Parent Languoid` (name)** - This column is ignored

The system looks up the parent by glottocode and establishes the relationship. If the parent doesn't exist yet, you'll see a validation error.

**Example**:
```
Name              | Glottocode  | Level    | Parent Languoid Glottocode
------------------|-------------|----------|---------------------------
Zaparoan          | zapa1251    | Family   | (empty)
Zaparo-Abishira   | zapa1252    | Language | zapa1251
Záparo            | zapa1253    | Language | zapa1252
```

### Mixed Hierarchies in One Import

You can include **families, languages, and dialects** all in the same spreadsheet:

- Each row represents a languoid (regardless of level)
- Families can appear alongside their languages and dialects
- The `Level (Glottolog)` column determines the type
- Hierarchical relationships are established via `Parent Languoid Glottocode`

**Example Mixed Import**:
```
Name              | Level    | Parent Languoid Glottocode
------------------|----------|---------------------------
Indo-European     | Family   | (empty)
Germanic          | Language | indo1319
English           | Language | germ1287
Cockney           | Dialect  | engl1234
Romance           | Language | indo1319
Spanish           | Language | roma1334
```

This flexibility allows you to import entire language families in a single operation.

### Importing Parent-Child Pairs

**Important**: If your spreadsheet contains both a parent and its child as new rows:

1. **Save the parent first** before saving the child
2. Use checkboxes to control save order:
   - Check only the parent row(s)
   - Click "Save"
   - Then check the child row(s)
   - Click "Save" again

**Why**: The child's `Parent Languoid Glottocode` must reference an existing languoid in the database. If the parent hasn't been saved yet, the validation will fail with "Parent languoid not found."

**Example Workflow**:
```
Step 1: Import spreadsheet with new family and language
  ✓ Afro-Asiatic (family) - NEW
  ✓ Berber (language, parent: Afro-Asiatic) - NEW

Step 2: Check only "Afro-Asiatic" row → Save
  ✓ Afro-Asiatic now exists in database

Step 3: Check "Berber" row → Save
  ✓ Berber successfully links to Afro-Asiatic
```

**Tip**: You can select multiple parent rows and save them in a batch, then save all their children in the next batch. This is efficient for importing large hierarchies.

### Updating Existing Languoids

If your spreadsheet contains glottocodes that match existing database records:

- The system **automatically loads** the existing languoid
- **Applies changes** from your spreadsheet (only modified fields)
- Row appears in the editor with changed cells marked **yellow**
- Checkbox is **automatically checked** for easy saving

**Workflow**:
1. Export languoids from the system
2. Edit in Excel/Google Sheets
3. Save as .xlsx or .csv
4. Import back into batch editor
5. Review changes (yellow cells)
6. Save to update records

This makes the "export → edit → import" workflow seamless for bulk updates.

## Common Batch Editing Tasks

### Adding Multiple New Languoids

1. Open an empty batch editor (click "Batch Edit" with no rows selected)
2. Click **"Add Row"** for each languoid you want to create
3. Fill in Name, Glottocode, and Level for each
4. Set Parent Languoid where appropriate
5. Fill in optional fields (ISO, Region, coordinates)
6. Check all new rows
7. Click **"Save"**

### Bulk Updating a Field

1. Select languoids from the list page
2. Open batch editor
3. Select the column you want to update
4. Edit one cell with the new value
5. Copy that cell (Ctrl+C)
6. Select all other cells in that column you want to update
7. Paste (Ctrl+V)
8. Check the affected rows
9. Click **"Save"**

### Importing a Language Family

1. Prepare a spreadsheet with all family members:
   - One row for the family (no parent)
   - Rows for each language (parent = family glottocode)
   - Rows for dialects (parent = language glottocode)
2. Import the spreadsheet (drag & drop or upload button)
3. Review imported rows (all auto-checked)
4. **Save in batches**:
   - First: Check and save family
   - Second: Check and save languages
   - Third: Check and save dialects
5. Verify relationships in the tree view

### Reclassifying Multiple Languoids

1. Select languoids that need reclassification
2. Open batch editor
3. Update the **Level** column for each (Family/Language/Dialect)
4. Update **Parent Languoid** if the hierarchy changes
5. Cells turn yellow showing changes
6. Check affected rows
7. Click **"Save"**
8. Calculated fields (Family, Subfamilies) update automatically

### Copying Coordinates to Multiple Languoids

If several languoids share the same geographic location:

1. Enter coordinates in one row (Latitude, Longitude)
2. Select and copy those cells
3. Select the coordinate cells for other rows
4. Paste
5. Check affected rows
6. Save

### Bulk Adding Alternate Names

1. Open batch editor with languoids that need alternate names
2. Edit **Alternate Names** column (chip-based editor)
3. Type name and press Enter to add
4. Copy/paste between rows if names are similar
5. Check affected rows
6. Save

## Validation in Batch Mode

### Real-Time Validation

As you edit cells, validation runs immediately:
- **Red cells** - Invalid data (must fix before saving)
- **Orange cells** - Warnings or conflicts (review required)
- **Yellow cells** - Edited but valid (unsaved changes)

### Common Validation Errors

**"Glottocode must be unique"**
- Another languoid already has this glottocode
- Fix: Choose a different glottocode

**"Parent languoid not found"**
- The glottocode in Parent Languoid Glottocode doesn't exist
- Fix: Verify the parent glottocode is correct, or save the parent first

**"Cannot be self-parent"**
- A languoid cannot be its own parent
- Fix: Choose a different parent

**"Invalid coordinate format"**
- Latitude/Longitude must be valid decimal numbers
- Fix: Enter coordinates as decimal degrees (e.g., 42.5, -122.4)

**"Name already exists"** (orange warning)
- Another languoid has the same name
- This is a warning, not an error
- Review: Confirm this is not a duplicate

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
- Use filters on the list page to load only relevant languoids
- Save in batches (check 50-100 rows at a time)
- Use import for very large additions (more efficient than manual entry)

## Tips for Efficient Batch Editing

1. **Use export as a template** - Export existing languoids, modify in Excel, re-import
2. **Copy/paste liberally** - Spread data across rows quickly
3. **Use checkboxes strategically** - Save only what you've verified
4. **Save frequently** - Don't lose work if validation fails on some rows
5. **Undo is your friend** - Ctrl+Z works for mistakes
6. **Import complex hierarchies** - Use spreadsheets for families with many members
7. **Use search on list page** - Load only the languoids you need to edit

## Transitioning from Single to Batch Editing

If you find yourself making the same change to many languoids:
- Stop editing individually
- Select all affected languoids on the list page
- Open batch editor
- Make the change once, copy/paste to others
- Save all at once

This saves significant time and reduces errors.
