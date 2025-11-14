# Editing Collaborators

Collaborators represent the people who contributed to items and documents in the archive. This section covers how to view and edit individual collaborator records.

## What is a Collaborator?

A **collaborator** is any person who has a documented relationship with items or documents in the archive. This includes:
- **Consultants** - Native speakers who provided linguistic data
- **Collectors** - Researchers who gathered materials
- **Performers** - Artists featured in recordings
- **Authors** - Writers of manuscripts or publications
- And many other roles (see Role field below)

Each collaborator has structured biographical information that helps identify and properly credit their contributions.

## Collaborator Fields

### Basic Information

#### Collaborator ID (required, auto-generated)
A unique numeric identifier for the collaborator.
- Automatically assigned when creating a new collaborator
- Cannot be changed once saved
- Used for internal tracking and references

#### Full Name (calculated)
The complete name of the collaborator as it will be displayed throughout the system.
- **Automatically calculated** from name components
- Cannot be edited directly
- Updates automatically when you edit First Name(s), Nickname, Last Name(s), or Name Suffix

**How Full Name is Calculated:**
- Format: `first_names "nickname" last_names name_suffix`
- Empty fields are skipped (no extra spaces)
- Nickname appears in quotes only if present
- Examples:
  - First: "Jane", Nickname: "JJ", Last: "Doe", Suffix: "Jr." → **Jane "JJ" Doe Jr.**
  - First: "Jane", Last: "Doe" → **Jane Doe**
  - Nickname: "JJ", Last: "Doe" → **"JJ" Doe**

#### First Name(s)
The given name(s) of the collaborator.
- Free text field
- Can include multiple given names
- Used to calculate Full Name
- Examples: "John", "Mary Ann", "José Miguel"

#### Nickname
An informal name or name commonly used by the collaborator.
- Appears in quotes within Full Name if present
- Optional field
- Examples: "Bob", "JJ", "Skip"

#### Last Name(s)
The family name(s) or surname(s) of the collaborator.
- Free text field
- Can include multiple surnames
- Used to calculate Full Name
- Examples: "Smith", "García López", "van der Berg"

#### Name Suffix
Additional name elements that follow the last name.
- Optional field
- Used to calculate Full Name
- Examples: "Jr.", "Sr.", "III", "PhD"

#### Other Names
Alternative names, spellings, or aliases for this collaborator.
- **Structured list** - Each name is stored as a separate item
- Use this for:
  - Alternative spellings
  - Maiden names
  - Traditional names
  - Names in other writing systems
- Examples: ["María Sánchez", "Maria Sanchez", "ᎹᎵᎠ"]

**Working with Other Names:**
- Click the edit icon to open the list editor
- Type a name and press Enter to add
- Click the X on a name to remove it
- Each name is stored separately (not comma-separated)
- Names are searchable throughout the system

### Cultural and Demographic Information

#### Gender
The gender of the collaborator.
- Free text field
- Use whatever terminology is appropriate and respectful
- Optional field

#### Clan/Society
Clan, society, or other traditional social group affiliation.
- Free text field
- Optional field
- Examples: "Bear Clan", "Kiva Society"

#### Origin
Place of origin or homeland of the collaborator.
- Free text field
- Can be general or specific
- Examples: "Northern Arizona", "Taos Pueblo", "Oaxaca"

#### Tribal Affiliations
Tribal or ethnic group affiliations.
- Free text field
- Can list multiple affiliations
- Examples: "Hopi", "Diné (Navajo)", "Zapotec"

### Language Proficiency

#### Native/First Languages
Languages the collaborator speaks natively.
- Multi-select relationship field
- Select from existing languoid records
- Search by name or glottocode
- Can specify multiple languages

#### Other Languages
Additional languages the collaborator speaks (non-native).
- Multi-select relationship field
- Select from existing languoid records
- Separate from native languages for tracking proficiency

### Biographical Dates

#### Birthdate
The collaborator's date of birth.
- Free text field (flexible formatting)
- Examples: "1950-03-15", "March 1950", "circa 1950"
- System calculates date range for sorting/filtering

#### Deathdate
The collaborator's date of death (if applicable).
- Free text field (flexible formatting)
- Leave empty if collaborator is living
- Examples: "2010-12-25", "December 2010", "circa 2010"

### Privacy and Restrictions

#### Anonymous
Flag indicating whether this collaborator should be treated as anonymous.
- True/False/Not specified
- When **True**: The collaborator's identifying information will be obscured in certain public contexts
- When **False** or **Not specified**: Full information is displayed

**When Anonymous Obscures Information:**
- **Public catalog displays** - Name may show as "Anonymous Collaborator" or similar
- **Public exports** - Identifying details may be omitted
- **Citation generation** - May use anonymous attribution

**When Anonymous Does NOT Obscure Information:**
- **Internal archive system** - Full details always visible to staff
- **Edit interfaces** - All information remains accessible for updates
- **Administrative reports** - Complete data is maintained

**Important Notes:**
- Setting a collaborator to anonymous does not delete any data
- The decision to show or hide information depends on the specific context (public vs. internal)
- Check with archive administration for specific policies on anonymous collaborators

### Additional Information

#### Other Info
Free-form text field for any additional information.
- No character limit
- Use for biographical notes, context, special considerations
- Can include historical information, cultural context, etc.

## Validation Rules {#collaborators-validation-rules}

### Required Fields {#collaborators-required-fields}
Two fields are required before saving:
- **Collaborator ID** (auto-generated, so always present)
- **Last Name(s)** (must be provided)

All other fields are optional, but **First Name(s)** is recommended for the Full Name to be meaningful.

### Uniqueness Constraints
- **Collaborator ID**: Must be unique (enforced automatically)
- **Names**: Can be duplicate (multiple people may have the same name)

## Editing a Single Collaborator

### From the Collaborator List
1. Navigate to the **Collaborators** page
2. Find the collaborator you want to edit
3. Click on their name to open the detail view
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

**Text fields** (First Names, Last Names, etc.) - Direct text input

**Full Name** - Read-only (automatically calculated from components)

**Other Names** - List editor:
- Click edit icon to open
- Type a name and press Enter to add
- Click X to remove a name
- Each entry is stored as a separate item

**Select fields** (Gender, Anonymous) - Dropdown or checkbox

**Relationship fields** (Native/First Languages, Other Languages) - Autocomplete search:
- Type to search by language name or glottocode
- Select from suggestions
- Can select multiple languages
- Clear individual selections as needed

## Common Single-Edit Tasks {#collaborators-common-tasks}

### Creating a New Collaborator
1. Navigate to **Collaborators** page
2. Click **"Add New Collaborator"** button
3. Fill in name fields:
   - First Name(s) (recommended)
   - Last Name(s) (required)
   - Nickname (optional)
   - Name Suffix (optional)
4. Notice Full Name updates automatically
5. Fill in optional fields as needed (origin, languages, dates, etc.)
6. Click **"Save"**

### Updating Basic Information
1. Open the collaborator detail page
2. Click the edit icon next to the field you want to change
3. Update the value
4. Save (auto-saves on blur or Enter)

### Changing the Full Name
You cannot edit Full Name directly. Instead:
1. Open the collaborator detail page
2. Edit the name component fields:
   - First Name(s)
   - Nickname
   - Last Name(s)
   - Name Suffix
3. Full Name updates automatically as you edit
4. Save each component field

### Adding Alternative Names
1. Open the collaborator detail page
2. Click edit icon next to "Other Names"
3. Type a name and press Enter
4. Repeat for additional names
5. Remove names by clicking the X
6. Save when done

**Tip**: Use Other Names for variant spellings, traditional names, or names in different writing systems. This helps ensure the collaborator can be found through various searches.

### Setting Language Proficiency
1. Open the collaborator detail page
2. Edit "Native/First Languages" field
3. Search for and select each native language
4. Edit "Other Languages" field for non-native languages
5. Each field saves automatically

### Marking a Collaborator as Anonymous
1. Open the collaborator detail page
2. Locate the "Anonymous" field
3. Set to **True** to mark as anonymous
4. Save the change
5. The collaborator's information will now be obscured in public contexts (but remains visible internally)

**Warning**: Review with archive administration before changing anonymity status, especially when removing anonymous status, as this may affect published catalogs or exports.

## Tips for Single Editing {#collaborators-tips-single-editing}

- **Use structured name fields** - Enter First, Last, Nickname, and Suffix separately rather than editing Full Name (which is calculated)
- **Add alternative names** - Use "Other Names" for variant spellings to improve searchability
- **Document language proficiency** - Distinguish between native and other languages for proper attribution
- **Respect privacy** - Use the Anonymous flag when appropriate and consult policies
- **Add context** - Use "Other Info" field for important biographical or cultural details

## When to Use Batch Editing Instead

Consider using the **Batch Editor** when you need to:
- Edit multiple collaborators at once
- Import collaborators from a spreadsheet
- Copy values between similar records
- Make the same change to many records
- Work with data offline in Excel

See the **Batch Editing Collaborators** section for details on bulk editing workflows.

