# Editing Items

Items are the main catalog records in the archive — recordings, texts, videos, books, and other language materials. Each item is identified by a **catalog number** and holds metadata about content, access, collaborators, languages, and provenance.

This section covers browsing the items list, viewing and editing individual records, and creating new items. For bulk editing, see **Batch Editing Items**.

## What is an Item?

An **item** is a catalog entry for language materials and cultural artifacts. Items are grouped into **collections** (for example ACH, CAR, NAL) based on the catalog number prefix (`ACH-123` belongs to the ACH collection).

Items link to:
- **Languages** — one or more languoids
- **Collaborators** — people with roles (author, speaker, collector, etc.) and optional citation-author flags
- **Titles** — one primary title plus additional titles, each with optional language
- **Collection** — derived automatically from the catalog number prefix when it matches a known collection abbreviation

## Browsing the Items List {#items-list}

Navigate to **Items** in the top navigation bar.

### Keyword Search

The keyword field is always visible at the top of the list. It searches across many item fields (catalog number, titles, description, collaborators, and more). Results update automatically after a short pause while you type.

### Advanced Filters

Click **Filters** to expand advanced options:

- **Text filters** — catalog number, call number, accession number, titles, language, collection, collaborator
- **Multi-select filters** — access level, resource type, genre, language description type, original format medium
- **Date range** — creation date from / to
- **Empty-field toggles** — find items where specific fields are blank

The filter count chip shows how many advanced filters are active (keyword search is not counted). **Clear** resets all filters.

### Opening Records

Two ways to open an item from the list:

1. **Click the catalog number** — proper link; supports right-click → Open in new tab, Ctrl/Cmd+click, or middle-click
2. **Click anywhere else on the row** — opens in the same tab for quick browsing

On mobile, items appear as cards instead of a table.

### Configurable Columns (Desktop)

Above the table, use the **Columns** menu (hamburger icon) to show or hide columns. Preferences are saved in your browser and persist across sessions.

**Default visible columns:** Catalog # (always shown), Call Number, Title(s), Resource Type, Languages, Access Level.

Column groups match the sections on the item detail page (Titles, Collection Information, Item Details, and so on). Catalog # cannot be hidden.

### Access Level Colors

Access level appears as a color-coded chip on the list and detail pages:

| Level | Color |
|-------|-------|
| 1 — Open Access | Green |
| 2 — Onsite viewing | Blue |
| 3 — Time-limited | Orange |
| 4 — Depositor-controlled | Yellow |

### Export

Use **Export Filtered Results** or **Export Selected** to download an Excel spreadsheet. Large exports run in the background; wait for the ready indicator, then download.

Export files include human-readable values and can be edited and re-imported through the batch editor (see **Batch Editing Items** and **Importing Item Spreadsheets**).

### Batch Edit Entry

Use the batch edit split button:

- **Batch Edit Filtered Results** — all items matching current filters
- **Batch Edit Selected** — checked rows only
- **Batch Edit (Empty)** — blank grid for import or manual entry

If item data is still loading from cache, the button shows progress. A dialog may warn when editing a very large unfiltered dataset.

When you open batch edit from the list, rows appear sorted by **catalog number** (not checkbox order).

## Item Fields

Fields on the detail page are grouped into cards. Most fields support inline editing: click the value or edit icon, change the value, press Enter or click outside to save.

### Titles

Items can have multiple titles. One title is marked **Primary** (default).

- **Primary title** — main display title; may include a language in parentheses, for example `Morning Prayer (Záparo)`
- **Additional titles** — add, edit, reorder, or remove via the titles editor on the detail page

**Batch editor note:** The batch grid exposes only **Default Title** and **First Additional Title**. Manage all other titles on the detail page.

### Description

| Field | Notes |
|-------|-------|
| Description Scope and Content | Main descriptive text |
| Language Description Type | Multi-select classification |
| Associated Ephemera | Related materials |

### Languages and Dialects

**Languages** — multi-select from existing languoids. Search by name or glottocode.

### Collaborators

**Collaborators** — people linked to this item with **roles** (Author, Speaker, Collector, etc.) and an optional **citation author** flag.

Collaborators marked as citation authors appear highlighted in blue and are included in generated citations.

### Collection Information

**Collection** — read-only on the detail page. Assigned automatically when the catalog number matches the pattern `ABC-123` (three-letter prefix). If no matching collection exists, the field stays empty until the prefix matches.

Do not expect to edit collection directly; change the catalog number prefix or ensure the collection record exists.

### Item Details

| Field | Notes |
|-------|-------|
| Access Level | Required for meaningful access control; levels 1–4 (see color table above) |
| Access Level Restrictions | Free text explaining restrictions |
| Copyrighted Notes | Copyright-related notes |
| Resource Type | Recording, text, video, book, etc. |
| Call Number | Shelf or internal call number |

### Important Dates

Date fields accept flexible text (for example `1950-03-15`, `March 1950`, `circa 1950`). The system computes date ranges for sorting where possible.

| Field | Notes |
|-------|-------|
| Creation Date | When the material was created |
| Accession Date | When the museum accessioned the item |

### Tags

| Field | Notes |
|-------|-------|
| Genre | Multi-select (Audio, Video, Text, etc.) |
| Language Description Type | Multi-select |

### Browse Categories

**Automatically calculated** from genre and resource type. Read-only — do not edit manually.

### Accessions

Provenance and acquisition information: accession number, type of accession, acquisition notes, collector and depositor fields, collection date, collecting notes, project grant, and related fields.

### Digitization

Original format medium, recorded on, equipment used, software used, conservation recommendation, location of original, and other information.

### Books

Publisher, publisher address, ISBN, LOC catalog number, total pages and physical description. Relevant primarily for published materials.

### Condition

Availability status, availability notes, condition, condition notes, IPM issues, conservation treatments performed.

### Location

Geographic fields: municipality, county, state, country, global region, recording context, public event.

**Look up address** — opens an overlay to search for a place and fill location fields and coordinates.

**Coordinates** — latitude and longitude on a map card when coordinates are present. Latitude must be between -90 and 90; longitude between -180 and 180.

### External

Temporary accession number, lender loan number, other institutional number.

### Files

File attachments are not yet displayed on the detail page. File management is planned for a future release.

### Metadata History

Read-only: last updated, modified by, date added.

## Validation Rules {#items-validation-rules}

### Required Fields {#items-required-fields}

- **Catalog Number** — required when creating or saving an item; must be unique in the system

Other fields are optional unless your local cataloging workflow requires them.

### Format and Uniqueness

- **Catalog Number** — must be unique; duplicates are rejected
- **Latitude / Longitude** — decimal numbers within valid ranges when provided
- **Choice fields** — access level, resource type, genre, and similar fields must use valid catalog vocabulary (labels or codes as shown in dropdowns)

### Collection from Catalog Number

When you save an item, the system reads the three-letter prefix before the hyphen in the catalog number (for example `NAL-0042` → `NAL`) and links the item to that collection if it exists. This happens automatically — you do not set collection on the batch grid or via import of the Collection column.

## Editing a Single Item {#items-single-edit}

### From the Items List

1. Navigate to **Items**
2. Find the item (keyword search or filters)
3. Click the **catalog number** to open the detail page
4. Click the edit icon next to a field
5. Make changes and save (Enter or click outside)

Press **Escape** to cancel an edit.

### Field-Specific Editors

**Text fields** — direct input

**Select fields** — dropdown with predefined choices

**Multi-select fields** (genre, language description type) — chip-based selection

**Languages** — autocomplete search; multiple selections

**Collaborators** — card-based editor with roles and citation author checkbox per person

**Titles** — list editor for multiple titles with primary flag and language

**Location** — text fields plus optional address lookup overlay

## Common Single-Edit Tasks {#items-common-tasks}

### Creating a New Item

1. Navigate to **Items**
2. Click **Add New Item**
3. Enter **Catalog Number** (required) and other fields by section
4. Click **Save**
5. You are taken to the detail page for further editing (titles, collaborators, etc.)

Use a catalog number that follows your collection's naming convention so the collection link is assigned automatically.

### Updating Access Level

1. Open the item detail page
2. Edit **Access Level** under Item Details
3. Optionally add **Access Level Restrictions** text
4. Save

### Adding Collaborators with Roles

1. Open the item detail page
2. Edit **Collaborators**
3. Search for a person, add them, select roles, and mark citation author if needed
4. Save

### Managing Titles

1. Open the item detail page
2. Use the **Titles** card to add, edit, set primary, or remove titles
3. Each title may include an associated language

### Updating Location and Coordinates

1. Open the item detail page
2. Edit location fields directly, or click **Look up address**
3. Confirm coordinates on the map card if shown

### Deleting an Item

Deletion is available only to users in the **Archivist** group.

1. Open the item detail page
2. Click **Delete**
3. Confirm by typing the catalog number as prompted

Deletion is permanent. Museum Staff and Read-Only users cannot delete items.

## Tips for Single Editing {#items-tips-single-editing}

- **Use catalog number links** when comparing multiple items in separate tabs
- **Check access level** before publishing or sharing metadata
- **Add collaborators with roles** rather than free-text names when possible
- **Use the detail page for titles** when an item needs more than two title slots
- **Verify catalog number prefix** if collection appears missing (~65% of items may lack a collection FK until the prefix matches a collection record)

## When to Use Batch Editing Instead

Consider the **Batch Editor** when you need to:

- Edit many items at once
- Import items from a spreadsheet
- Copy values between similar records (genre, access level, location fields)
- Export filtered or selected sets for offline editing

See **Batch Editing Items** for bulk workflows.

**See also:** [Editing Languoids](#editing-languoids) · [Editing Collaborators](#editing-collaborators) · [Batch Editing Items](#item-batch)
