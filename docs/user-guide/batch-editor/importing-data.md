# Importing Data from Spreadsheets

The Batch Editor supports importing Excel and CSV files, making it easy to perform bulk data ingests with full validation.

## Supported Formats

- **Excel** - `.xlsx` (Excel 2007+) and `.xls` (Excel 97-2003)
- **CSV** - `.csv` (Comma-separated values)
- **File size limit** - 10 MB
- **Row limit** - 1000 rows (warning shown if exceeded)

## Import Methods

### Upload Button
1. Click **"Import Spreadsheet"** button in the toolbar
2. Select your file in the file picker
3. Wait for import to complete
4. Imported rows appear in the editor

### Drag and Drop
1. Drag your Excel/CSV file from your computer
2. Drop it onto the spreadsheet area
3. A visual indicator confirms the drop zone
4. Import proceeds automatically

## Column Mapping

The importer automatically matches spreadsheet columns to batch editor fields:
- **Case-insensitive** matching
- **Whitespace** is trimmed
- **Underscores** replaced with spaces

### Example Mappings
- `Parent_Languoid_Glottocode` → Parent Languoid
- `name abbreviation` → Name Abbreviation
- `ISO 639-3` → ISO 639-3

### Unrecognized Columns
Columns that don't match batch editor fields are ignored. This allows you to include extra columns in your spreadsheet without causing errors.

### Required Columns
At least one recognized column must be present. If no columns match, you'll see an error message.

## Smart Row Reconciliation

The importer intelligently handles existing vs. new records:

### If Glottocode Matches Database
- Loads the existing record from the database
- Applies changes from your spreadsheet
- Only updates fields that actually changed
- Row appears in the editor ready to save

### If Glottocode Matches Existing Spreadsheet Row
- Modifies the existing row in the editor
- Only applies actual changes
- Prevents duplicate rows

### If Glottocode is New
- Creates a new draft row
- Fills in values from spreadsheet
- Row is ready to be saved as a new record

### Name Conflict Detection
If a new row has a name matching an existing languoid but no glottocode match:
- Cell turns **orange** with a warning
- Tooltip alerts you to potential duplicate
- Review and confirm this isn't a duplicate before saving

## Data Parsing

### Text Fields
- Whitespace is trimmed
- Empty cells → empty string

### Decimal Fields (Latitude, Longitude)
- Must be valid numbers
- Examples: `42.5`, `-122.419906`

### Select Fields (Level)
- Fuzzy matching supported
- `"lang"` → `"Language"`
- `"dial"` → `"Dialect"`
- Case-insensitive

### Relationship Fields (Parent Languoid)
- Looks up by glottocode
- Must match an existing languoid or one in the import file
- Empty cells → no parent (for families)

### String Array Fields (Alternate Names)
- Parses comma-separated list
- `"Zaparo, Kayapi"` → `["Zaparo", "Kayapi"]`
- Order doesn't matter

## Import Workflow

1. **Prepare your spreadsheet**
   - Include column headers
   - Use standard column names (see Column Mapping)
   - Fill in required fields (Name, Glottocode, Level)

2. **Import the file**
   - Click "Import Spreadsheet" or drag & drop
   - Wait for parsing and validation

3. **Review imported rows**
   - Imported rows are automatically checked
   - Editor scrolls to first imported row
   - Validation runs immediately on all cells

4. **Fix any errors**
   - Red cells indicate invalid data
   - Orange cells indicate warnings/conflicts
   - Edit cells to fix issues

5. **Save**
   - Click "Save" to save all checked rows
   - Validation runs again before save
   - Success message confirms saved rows

## Validation During Import

### Immediate Validation
All imported cells are validated immediately:
- Spinner cursor shows validation in progress
- Red cells indicate validation errors
- Fix errors before attempting to save

### Foreign Key Lookups
Parent Languoid values are looked up during import:
- Uses in-memory cache for fast lookups
- Invalid glottocodes → validation error
- No additional API calls needed

## Undo Import

If you made a mistake:
1. Press **Ctrl+Z (Cmd+Z)**
2. Entire import is undone as a single action
3. All imported rows and changes are removed
4. Previous state is restored

## Tips for Successful Imports

### Use Export as Template
1. Export existing records from the Languoid List
2. Use the exported spreadsheet as a template
3. Ensures column names match exactly

### Test with Small Files First
- Start with 5-10 rows to verify formatting
- Once working, import larger files

### Check Required Fields
- Name, Glottocode, and Level are required
- Empty required fields → red cells

### Validate Glottocodes
- Ensure glottocodes are correct before importing
- Invalid glottocodes → validation errors

### Handle Existing Records
- If updating existing records, include their glottocode
- System will load and update the existing record
- Only changed fields are updated

### Review Before Saving
- Import does NOT automatically save to database
- Review all imported data in the editor
- Fix any validation errors
- Click "Save" when ready

## Common Import Issues

### "No recognized columns found"
- **Cause**: Column headers don't match expected names
- **Fix**: Rename columns to match (e.g., "Name", "Glottocode", "Level (Glottolog)")

### Red cells after import
- **Cause**: Data fails validation (e.g., empty required field, invalid format)
- **Fix**: Edit the cells to fix the validation errors

### Orange "Name already exists" warning
- **Cause**: Name matches an existing languoid but glottocode doesn't
- **Fix**: Verify this is a new languoid, not a duplicate. Add correct glottocode if it's existing.

### Parent Languoid shows ID instead of name
- **Cause**: Glottocode couldn't be resolved to a languoid
- **Fix**: Verify parent glottocode is correct and exists in database

### Import appears to freeze
- **Cause**: Validation running on many cells
- **Indicator**: Spinner cursor shows processing
- **Fix**: Wait for validation to complete (typically 1-5 seconds for 100 rows)

