# Editing Languoids

Languoids are the core data model representing languages, dialects, and language families in the archive. This section covers how to view and edit individual languoid records.

## What is a Languoid?

A **languoid** is any linguistic entity in the hierarchy:
- **Family** - A top-level language family (e.g., Indo-European, Sino-Tibetan)
- **Language** - An individual language within a family (e.g., English, Mandarin)
- **Dialect** - A variant of a language (e.g., Cockney English, Sichuanese Mandarin)

All three types share the same data structure and can be edited using the same interface.

## Languoid Fields

### Basic Information

#### Name (required)
The primary name of the languoid. This is how it will be displayed throughout the system.
- Must not be empty

#### Name Abbreviation
A shortened form of the name for display in compact spaces.
- Optional field
- Used primarily when a subfamily contains the name of its parent (e.g. Southeastern for Southeastern Pama-Nyungan)

#### Glottocode (required)
A unique identifier from Glottolog (8 characters: 4 letters + 4 digits).
- Must be unique across all languoids
- Format: `abcd1234` (e.g., `indo1319`, `zapa1253`)
- Cannot be changed once saved (acts as permanent identifier)

#### ISO 639-3
The three-letter ISO 639-3 language code.
- Optional (not all languoids have ISO codes)
- Exactly 3 letters, but can enter list of multiple
- Primarily used for languages (not families or dialects)

### Classification

#### Level (Glottolog) (required)
Specifies the type of languoid. Choose from:
- **Family** - Top-level language family with no parent
- **Language** - Individual language within a family
- **Dialect** - Variant or subdivision of a language

This field determines the languoid's place in the hierarchy.

#### Level (NAL)
The NAL (Native American Languages) classification level.
- **Automatically calculated** - Do not edit manually
- Computed based on Level (Glottolog) and other factors
- May differ from Glottolog classification for NAL-specific taxonomy

#### Parent Languoid
The parent of this languoid in the hierarchy.
- **Families** - Leave empty (no parent)
- **Languages** - Select the family they belong to
- **Dialects** - Select the parent language

**Selecting a Parent:**
- Search by name or glottocode
- Displays as "Name (glottocode)"
- Can be changed if languoid is reclassified

**Validation:**
- A languoid cannot be its own parent
- Must reference an existing languoid

#### Alternate Names
Other names by which this languoid is known.
- Comma-separated list
- Examples: alternate spellings, endonyms, historical names
- Useful for search and discovery

### Geographic Information

#### Region
The geographic area where this languoid is/was spoken.
- Free text field
- Examples: "Amazon Basin", "Pacific Northwest", "Central Asia"

#### Latitude and Longitude
Geographic coordinates for the languoid's primary location.
- **Latitude**: Decimal degrees, -90 to 90 (negative = South)
- **Longitude**: Decimal degrees, -180 to 180 (negative = West)
- Examples: `42.3601`, `-71.0589`

**Tips:**
- Use decimal format (not degrees/minutes/seconds)
- Precision up to 16 decimal places supported
- Can be left empty if location unknown

#### Tribes
Associated tribal groups or communities.
- Free text field
- Can list multiple tribes

### Hierarchical Fields (Calculated)

These fields are **automatically calculated** based on the languoid's position in the hierarchy:

- **Family** - The top-level family this languoid belongs to
- **Primary Subfamily** - First-level subfamily
- **Secondary Subfamily** - Second-level subfamily

These fields are read-only and update automatically when you change the Parent Languoid.

### Additional Information

#### Notes
Free-form text field for any additional information.
- No character limit
- Use for context, historical notes, classification disputes, etc.

#### Anonymous
Flag indicating whether this languoid should be treated as anonymous in certain contexts.
- True/False/Not specified

## Hierarchical Relationships

### Understanding the Tree Structure

Languoids form a hierarchical tree:

```
Indo-European (Family)
├── Germanic (Language)
│   ├── English (Language)
│   │   └── Cockney (Dialect)
│   └── German (Language)
└── Romance (Language)
    ├── Spanish (Language)
    └── French (Language)
```

### Parent-Child Rules

1. **Families have no parent** - They are the top of the tree
2. **Languages have a family as parent** - Or another language for sub-classification
3. **Dialects have a language as parent** - Or another dialect for sub-dialects
4. **No circular references** - A languoid cannot be its own ancestor

### Changing Relationships

When you change a languoid's parent:
- All calculated fields update automatically (Family, Subfamilies)
- Descendants remain attached (children move with the parent)
- Validation ensures no circular references are created

## Validation Rules

### Required Fields
These fields must have a value before saving:
- **Name**
- **Glottocode**
- **Level (Glottolog)**

### Format Validation
- **Glottocode**: Typically 8 characters (but format varies)
- **ISO 639-3**: Must be exactly 3 letters if provided
- **Latitude**: Must be between -90 and 90
- **Longitude**: Must be between -180 and 180

### Uniqueness Constraints
- **Glottocode**: Must be unique across all languoids in the system
- **Name**: Can be duplicate (names may be reused), but you'll see a warning

## Editing a Single Languoid

### From the Languoid List
1. Navigate to the **Languages** page
2. Find the languoid you want to edit
3. Click on its name to open the detail view
4. Click the edit icon (✏️) next to any field
5. Make your changes
6. Press Enter or click outside the field to save

### Inline Editing
Most fields support inline editing:
- Click the field value or edit icon
- Type your changes
- Press Enter to save
- Press Escape to cancel

### Field-Specific Editors

**Text fields** - Direct text input

**Select fields** (Level) - Dropdown menu with predefined options

**Relationship fields** (Parent Languoid) - Autocomplete search:
- Type to search by name or glottocode
- Select from suggestions
- Clear to remove relationship

**Coordinate fields** (Lat/Long) - Numeric input with validation

**Array fields** (Alternate Names) - Chip-based editor:
- Type and press Enter to add
- Click X to remove
- Reorder by clicking and dragging

## Common Single-Edit Tasks

### Creating a New Languoid
1. Navigate to **Languages** page
2. Click **"Add New Languoid"** button
3. Fill in required fields:
   - Name
   - Glottocode
   - Level (Glottolog)
4. Fill in optional fields as needed
5. Click **"Save"**

### Updating Basic Information
1. Open the languoid detail page
2. Click the edit icon next to the field you want to change
3. Update the value
4. Save (auto-saves on blur or Enter)

### Changing the Parent
1. Open the languoid detail page
2. Click edit icon next to "Parent Languoid"
3. Search for the new parent by name or glottocode
4. Select from the dropdown
5. Save
6. Notice that Family and Subfamily fields update automatically

### Adding Alternate Names
1. Open the languoid detail page
2. Click edit icon next to "Alternate Names"
3. Type a name and press Enter
4. Repeat for additional names
5. Remove names by clicking the X
6. Save when done

### Updating Geographic Information
1. Open the languoid detail page
2. Edit Region field with free text
3. Edit Latitude and Longitude with decimal coordinates
4. Edit Tribes field
5. All fields save automatically

### Viewing Descendants
On the languoid detail page, you can see:
- **Direct children** - Immediate descendants
- **Full tree** - All descendants recursively

This helps you understand the languoid's place in the hierarchy.

## Tips for Single Editing

- **Use search** - Find languoids quickly by name or glottocode
- **Check relationships** - Verify parent-child links are correct
- **Add context** - Use the Notes field for important details
- **Verify coordinates** - Double-check latitude/longitude values
- **Use alternate names** - Help others find languoids by adding common variants

## When to Use Batch Editing Instead

Consider using the **Batch Editor** when you need to:
- Edit multiple languoids at once
- Import data from a spreadsheet
- Copy values between similar records
- Make the same change to many records
- Work with data offline in Excel

See the **Batch Editor** section for details on bulk editing workflows.

