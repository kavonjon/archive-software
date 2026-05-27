# Importing Item Spreadsheets

The Item Batch Editor supports importing Excel and CSV files for bulk updates and new catalog entries. This guide covers item-specific column mapping, reconciliation, and validation.

For shared import mechanics (file formats, drag-and-drop, undo), see the introduction in **Importing Data from Spreadsheets**. For general batch editing, see **Batch Editor Overview**.

## Supported Formats

- **Excel** — `.xlsx` (Excel 2007+) and `.xls` (Excel 97-2003)
- **CSV** — `.csv`
- **File size limit** — 10 MB
- **Row limit** — 1000 rows (warning if exceeded)

## Import Methods

1. **Import Spreadsheet** button in the batch editor toolbar, or  
2. **Drag and drop** a file onto the spreadsheet area

Imported rows appear in the grid but are **not saved to the database** until you click **Save Changes**.

## Column Mapping

Column matching is **case-insensitive**. Underscores and extra spaces are normalized.

Examples:

- `Catalog_Number` → Catalog Number  
- `item access level` → Access Level  
- `Description Scope and Content` → Description  

Unrecognized columns are ignored without error.

At least one recognized item column must be present.

## Match Key: Catalog Number

Unlike languoids (glottocode) or collaborators (Collaborator ID), items reconcile import rows by **Catalog Number**:

| Situation | Behavior |
|-----------|----------|
| Catalog number exists in database | Load that item; apply only changed fields; yellow cells |
| Catalog number matches another row already in the grid | Update that grid row |
| Catalog number is new | Create draft row for new item |
| Same catalog number on multiple **file** rows | **Last file row wins**; dialog lists superseded rows |

## Export-Only Columns

### Collection

Exports may include a **Collection** column (abbreviation such as `NAL`). This column is **ignored on import**.

Collection is assigned automatically from the catalog number prefix when you **save** (for example `NAL-0042` → NAL collection). To change collection association, update the catalog number prefix — do not rely on the Collection spreadsheet column.

## Recognized Columns

The importer accepts these column names (and common aliases):

### Identification and Metadata

| Spreadsheet column | Batch field |
|--------------------|-------------|
| Catalog Number | Catalog Number (required for new items) |
| Access Level, Item Access Level | Access Level |
| Default Title, Title, Primary Title | Default Title |
| First Additional Title, Secondary Title | First Additional Title |
| Description, Description Scope and Content | Description |
| Resource Type | Resource Type |
| Call Number | Call Number |
| Associated Ephemera | Associated Ephemera |

### Relationships

| Spreadsheet column | Batch field |
|--------------------|-------------|
| Languages, Language | Languages |
| Collaborators, Collaborators (Role, Citation) | Collaborators (Role, Citation) |

### Dates

Creation Date, Accession Date, Collection Date, Deposit Date

### Classification and Accession

Genre, Language Description Type, Access Level Restrictions, Accession Number, Type of Accession, Acquisition Notes, Collector Name, Collector Info, Collecting Notes, Depositor Name, Depositor Contact Information, Project Grant

### Condition and Format

Availability Status, Availability Status Notes, Condition, Condition Notes, Original Format Medium, Location of Original, Other Institutional Number, Conservation Recommendation, Conservation Treatments Performed, Equipment Used, Software Used, IPM Issues

### Location

Municipality or Township, County or Parish, State or Province, Country or Territory, Global Region, Recording Context, Public Event, Recorded On, Latitude, Longitude

### Publication

Publisher, Publisher Address, ISBN, LOC Catalog Number, Total Number of Pages and Physical Description

### External

Temporary Accession Number, Lender Loan Number, Other Information

### Additional Title Columns from Export

Exports may list Second Additional Title through Tenth Additional Title. Only **First Additional Title** maps to the batch grid. Manage other titles on the item **detail page**.

## Data Parsing

### Text Fields

Whitespace trimmed; empty cells treated as empty.

### Choice Fields (Select)

Access Level, Resource Type, Type of Accession, Availability Status, Condition, Original Format Medium, and similar fields support:

- Full labels: `3 - Access protected by a time limit`
- Numeric codes: `3`
- Fuzzy partial match where safe

**Unrecognized values** → red cell with error; raw text preserved for correction. Fix before save.

### Titles

Format: `Title text (Language name)` — for example `Ceremony recording (Záparo)`.

Empty title cells are treated as empty (not a change vs blank in database).

Re-importing an export should not falsely mark blank additional titles as modified when the database has no additional title.

### Languages

Comma-separated language names and/or glottocodes:

```
Záparo (zapa1253), zapa1254
```

Each entry must match an existing languoid.

### Collaborators with Roles

Comma-separated entries with roles and optional citation flag:

```
Jane Doe (Author, Speaker; in citation), John Smith (Collector)
```

Unmatched names may show as invalid (red) — correct or remove before save.

### Multi-Select (Genre, Language Description Type)

Comma-separated valid choice labels.

### Coordinates

Decimal numbers. Validated on import/save for range.

## Import Workflow

1. **Prepare spreadsheet** — use export as template for column headers  
2. **Open batch editor** — filtered, selected, or empty  
3. **Import file** — button or drag-and-drop  
4. **Review duplicate catalog dialog** if the file had repeated catalog numbers  
5. **Fix red cells** — validation errors  
6. **Review yellow cells** — intended changes  
7. **Save Changes** — persists to database  

## Validation During Import

Imported cells are validated after parsing:

- Parser errors (bad choice, bad title format) → red, no save  
- Backend validation runs for direct model fields (catalog uniqueness, coordinates, etc.)  
- Virtual/composite fields (titles, collaborators, languages) use parser rules; skipped for redundant backend checks  

Import does **not** auto-save. Always review before Save.

## Duplicate Catalog Numbers in One File

If row 5 and row 20 both have catalog number `ACH-001`:

- One grid row remains (row 20's values)
- Dialog reports that row 5 was superseded
- Not a save blocker

## Duplicate Catalog Numbers in the Grid

If you paste the same catalog number into multiple rows while editing:

- First row in grid order keeps the value  
- Later rows turn red  
- Save blocked until fixed  

## Undo Import

**Ctrl+Z (Cmd+Z)** undoes the entire import as one action, restoring the prior grid state.

## Tips for Successful Item Imports

1. **Export first** — guarantees matching column headers  
2. **Catalog number required** for each new item row  
3. **Ignore Collection column** on re-import — it is export-only  
4. **Valid choice labels** — typos in access level or resource type show red  
5. **Two title columns in batch** — extra export title columns beyond First Additional are not imported  
6. **Test small files** — 5–10 rows before large imports  
7. **Review before Save** — import loads the grid only  

## Common Import Issues

### "No recognized columns found"

Column headers do not match expected names. Rename to match export headers (start with Catalog Number, Access Level, etc.).

### Red cells after import

Validation failed — empty required catalog number, invalid choice, unknown collaborator/language, duplicate catalog in grid, etc. Edit cells to fix.

### Collection column seems ignored

Expected — Collection is export-only. Collection updates via catalog prefix on save.

### Re-import marks title cells changed incorrectly

Ensure you use a current export template. Default Title should show readable text, not `[object Object]`. Blank First Additional Title should not highlight if the item has only a primary title.

### Import appears slow

Validation runs on all imported cells. Wait for the spinner cursor to finish (typically a few seconds per 100 rows).

**See also:** [Batch Editing Items](#item-batch) · [Importing Data from Spreadsheets](#importing-data) · [Editing Items](#editing-items)
