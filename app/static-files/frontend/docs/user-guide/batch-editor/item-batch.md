# Batch Editing Items

The Item Batch Editor provides a spreadsheet-style interface for efficiently editing multiple catalog records at once. This section covers item-specific features, import columns, and workflows.

## Overview {#item-batch-overview}

The batch editor allows you to:

- Edit multiple items simultaneously in a spreadsheet view
- Import items from Excel or CSV files
- Copy and paste data between rows
- Export filtered or selected items and re-import after editing
- Save selected rows or all changed rows at once

For general batch editor features (keyboard shortcuts, copy/paste, color coding, undo), see **Batch Editor Overview**.

**Scale:** The full item dataset is large (~4,400 rows). The system caches data in Redis for performance. The first load may take 15–20 seconds; subsequent opens are much faster.

## Opening the Item Batch Editor

From the **Items** list:

1. Optionally **select rows** with checkboxes and/or **apply filters**
2. Use the batch edit split button:
   - **Batch Edit Filtered Results**
   - **Batch Edit Selected**
   - **Batch Edit (Empty)** — blank grid for import-only workflows
3. Wait for cache loading if prompted

**Row order:** When opening from the list, rows sort by **catalog number** (case-insensitive), matching the list order — not checkbox selection order.

**Within a session:** Import adds new rows at the bottom; manual refresh preserves your current row order.

## Batch-Specific Features for Items

### Catalog Number as Primary Key

**Catalog Number** is the main identifier:

- Required for new items
- Must be **unique** across the system
- Used to match existing records on import (same catalog number → load and update that item)
- Drives automatic **collection** assignment from the prefix (`ABC-123` → collection `ABC`) on save

### Titles (Two Columns Only)

The batch grid has two title columns:

| Column | Meaning |
|--------|---------|
| Default Title | Primary title with optional language |
| First Additional Title | First non-primary title with optional language |

Format in cells and exports: `Title text (Language name)` — for example `Morning Prayer (Záparo)`.

**Detail page vs batch:** The item detail page supports many titles. The batch editor intentionally exposes only two slots. Use the detail page for full title management.

Exports may include additional title columns (Second Additional Title, etc.). Only **First Additional Title** maps to batch import; other additional title columns are ignored on import.

### Collaborators (Role, Citation)

The **Collaborators (Role, Citation)** column uses a specialized editor:

- Search and add collaborators
- Assign one or more **roles** per person
- Mark **citation author** per person
- Invalid names from import appear as red chips — fix or remove before saving

Import format example: `Jane Doe (Author, Speaker; in citation)`

### Languages

**Languages** — multi-select languoids. Search by name or glottocode. Comma-separated names or glottocodes in import spreadsheets.

### Collection (Not Editable in Batch)

There is **no Collection column** in the batch grid. Collection is set automatically from the catalog number prefix when you save.

Exports may include a **Collection** column (abbreviation) for reporting. That column is **ignored on import** — do not rely on it to change collection; update the catalog number prefix instead.

### Access Level

Four levels with human-readable labels in exports and dropdowns:

1. Open Access  
2. Materials are available to view onsite but no copies may be distributed  
3. Access protected by a time limit  
4. Depositor (or someone else) controls access to the resource  

Invalid access level text on import shows a **red cell** — correct the value before saving.

### Computed / Read-Only Fields

These are **not** in the batch grid:

- Browse categories (computed from genre and resource type)
- Collection FK (derived from catalog number on save)
- Metadata timestamps

## Batch Editor Columns

The grid includes approximately 60 editable columns, grouped as follows:

**Core identification:** Catalog Number, Access Level, Default Title, First Additional Title, Description, Resource Type, Call Number, Associated Ephemera

**Relationships:** Languages, Collaborators (Role, Citation)

**Dates:** Creation Date, Accession Date, Collection Date, Deposit Date

**Classification:** Genre, Language Description Type, Access Level Restrictions

**Accession & acquisition:** Accession Number, Type of Accession, Acquisition Notes, Collector Name, Collector Info, Collection Date, Collecting Notes, Depositor Name, Depositor Contact Information, Project Grant

**Condition & availability:** Availability Status, Availability Status Notes, Condition, Condition Notes

**Format & conservation:** Original Format Medium, Location of Original, Other Institutional Number, Conservation Recommendation, Conservation Treatments Performed, Equipment Used, Software Used, IPM Issues

**Location:** Municipality or Township, County or Parish, State or Province, Country or Territory, Global Region, Recording Context, Public Event, Recorded On, Latitude, Longitude

**Publication (books):** Publisher, Publisher Address, ISBN, LOC Catalog Number, Total Number of Pages and Physical Description

**External:** Temporary Accession Number, Lender Loan Number, Other Information

For the full import column list and aliases, see **Importing Item Spreadsheets**.

## Duplicate Catalog Numbers

Behavior depends on **where** the duplicate appears:

### Same Catalog Number Twice in an Import File

- **Last row in the file wins** — one grid row per catalog number
- An **information dialog** lists superseded file row numbers
- This is not a save blocker — fix your source file if needed

### Duplicate Catalog Numbers in the Grid (Typing or Paste)

- **First row in grid order wins**
- Later rows show a **red** invalid catalog cell
- Save is blocked until resolved

## Importing Item Spreadsheets

See **Importing Item Spreadsheets** for formats, column names, and reconciliation rules.

Quick reference — recognized columns include:

**Identification & metadata:** Catalog Number, Access Level / Item Access Level, Default Title / Title / Primary Title, First Additional Title / Secondary Title, Description, Resource Type, Call Number, Associated Ephemera

**Relationships:** Languages / Language, Collaborators / Collaborators (Role, Citation)

**Dates:** Creation Date, Accession Date, Collection Date, Deposit Date

**Classification & accession:** Genre, Language Description Type, Access Level Restrictions, Accession Number, Type of Accession, Acquisition Notes, Collector Name, Collector Info, Collecting Notes, Depositor Name, Depositor Contact Information, Project Grant

**Condition & format:** Availability Status, Availability Status Notes, Condition, Condition Notes, Original Format Medium, Location of Original, Other Institutional Number, Conservation fields, Equipment Used, Software Used, IPM Issues

**Location & publication:** All location fields, Latitude, Longitude, Publisher fields, ISBN, LOC Catalog Number, Total Number of Pages and Physical Description

**External:** Temporary Accession Number, Lender Loan Number, Other Information

**Export-only (ignored on import):** Collection

Unrecognized columns are safely ignored.

### Updating Existing Items

If **Catalog Number** matches an existing item:

- The system loads that item from the database
- Applies only changed fields from your spreadsheet
- Changed cells appear **yellow**
- Row checkbox is auto-selected for saving

**Workflow:** Export → edit in Excel → import → review yellow cells → Save.

### New Items from Import

Rows with catalog numbers not in the database become **draft rows**. Fill required fields and save to create new items.

## Common Batch Editing Tasks {#item-batch-common-tasks}

### Bulk Updating Access Level

1. Filter or select items on the list page
2. Open batch editor
3. Edit **Access Level** on one row, copy the cell
4. Paste into other rows in the column
5. Check affected rows → **Save**

### Importing Many New Items

1. Open **Batch Edit (Empty)**
2. Prepare spreadsheet with at least **Catalog Number** and other fields
3. Import via **Import Spreadsheet** or drag-and-drop
4. Fix any red validation cells
5. Review duplicate-catalog dialog if shown
6. **Save**

### Export → Edit → Re-Import

1. On the Items list, **Export Filtered** or **Export Selected**
2. Edit the downloaded `.xlsx` in Excel
3. Open batch editor (filtered, selected, or empty)
4. Import the file
5. Review yellow (changed) and red (invalid) cells
6. **Save**

### Paste Coordinates to Multiple Items

1. Enter latitude and longitude on one row
2. Copy both cells
3. Select target rows' coordinate cells
4. Paste → check rows → Save

## Validation in Batch Mode {#item-batch-validation}

### Cell Colors

- **Red** — invalid; must fix before save
- **Yellow** — edited, valid, unsaved
- **Orange** — conflict or warning (another user changed the same field, or review needed)
- **White** — unchanged

### Common Validation Errors {#item-batch-validation-errors}

**Catalog number must be unique**

Another item (or another row in the grid) already uses this catalog number. Fix the duplicate or remove the extra row.

**"…" is not a valid choice**

A select field (access level, resource type, condition, etc.) has unrecognized text from import. Use a valid label or numeric code from the dropdown.

**Collaborator / language not found**

A name or glottocode in import could not be matched. Fix spelling or create the collaborator/language record first.

**Invalid coordinate format**

Latitude and longitude must be valid decimal numbers within range.

**Title format errors**

Use `Title (Language)` format in title columns. Empty titles should be left blank.

### Saving

1. Check rows to save (or save all changed rows when prompted)
2. Click **Save Changes**
3. If validation fails, a dialog lists problem rows/fields
4. Fix red cells and try again

Conflicting fields (edited elsewhere while you worked) may show orange — review tooltips and re-edit or refresh.

## Performance with Large Datasets

- Virtualized grid supports thousands of rows with smooth scrolling
- Full cache load: ~15–20 seconds first time; under 1 second when cached
- Async export for large sets (~18 seconds for full catalog)
- Save selected batches (50–100 rows) if working with very large filtered sets

**Tips:**

- Filter on the list before batch edit to work on a subset
- Use export/import for very large bulk adds
- Wait for cache loading to finish before batch edit filtered

## Tips for Efficient Batch Editing {#item-batch-tips}

1. **Export as template** — column headers match import expectations
2. **Do not edit Collection in spreadsheets** — use catalog number prefix
3. **Two title columns in batch** — use detail page for more titles
4. **Watch duplicate catalog dialogs** after import
5. **Choice fields need valid labels** on import — typos show red
6. **Save frequently** in large sessions
7. **Undo (Ctrl+Z / Cmd+Z)** reverses import as one action

## Transitioning from Single to Batch Editing

If you are making the same change to many items:

- Stop editing individually
- Filter or select items on the list
- Open batch editor
- Change once, copy/paste to other rows
- Save all at once

**See also:** [Batch Editor Overview](#batch-editor) · [Importing Item Spreadsheets](#importing-data-items) · [Editing Items](#editing-items) · [Keyboard Shortcuts](#keyboard-shortcuts)
