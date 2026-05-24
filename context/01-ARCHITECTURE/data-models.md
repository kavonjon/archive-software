# Data Models

## Core Entities

### Item (Catalog Entry)

**Purpose**: Represent individual archived materials

**Scale**: 4,400+ items

**Key Fields** (60 total):
- **Identifiers**: catalog_number (unique), call_number
- **Content**: description_scope_and_content, resource_type, genre
- **Dates**: creation_date, accession_date, deposit_date (flexible text format)
- **Location**: municipality, county, state, country, global_region
- **Access**: item_access_level (1-4 scale), access_level_restrictions, copyrighted_notes
- **Condition**: availability_status, condition, ipm_issues
- **Books**: publisher, isbn, loc_catalog_number, page count
- **Computed**: browse_categories (auto from genre/type), collection (auto from prefix)

**Relationships**:
- **Collection** (FK): Auto-assigned from catalog_number prefix (e.g., "ACH-123" - ACH)
- **Languages** (M2M): Directly to Languoid model
- **Collaborators** (M2M via CollaboratorRole): Through-model with roles + citation flag
- **Titles** (via ItemTitle): Through-model with title text + language FK + default flag

**Through-Models**:

**CollaboratorRole** (Item <> Collaborator):
- `collaborator` (FK to Collaborator)
- `roles` (MultiSelectField): author, speaker, translator, consultant, etc. (20+ choices)
- `citation_author` (Boolean): Whether appears in citations

**ItemTitle** (Item <> Title):
- `title` (CharField): Title text
- `language` (FK to Languoid): Title language
- `default` (Boolean): Primary title flag (only one per item)

**Computed Fields** (via signals):
- `browse_categories`: Auto-calculated from genre, resource_type, language_description_type, public_event
  - Sort order for browse UI: texts, grammars, dictionaries, narratives, songs, ceremonies, prayers, interviews, photos, videos, other
- `collection`: Auto-assigned from catalog_number prefix pattern (`^([A-Za-z]{3})-`)

**Batch Editor**: State-of-the-art reference (60 fields, custom editors, invalid data preservation)

### Item API Field Organization

The `InternalItemSerializer` maps Django template fields to a flat API structure. Fields are organized by the template section they came from — useful when adding new fields or debugging which section a field belongs to:

| Template Section | Fields |
|-----------------|--------|
| **General** | `catalog_number`, `access_level`, `call_number`, `accession_date`, `additional_digital_file_location` |
| **Titles** | `primary_title`, `titles`, `indigenous_title`, `english_title` |
| **Content/Description** | `description`, `resource_type`, `genre`, `language_description_type`, `creation_date`, `associated_ephemera` |
| **Availability/Condition** | `availability_status`, `condition`, `condition_notes`, `ipm_issues`, `conservation_treatments_performed` |
| **Accessions** | `accession_number`, `type_of_accession`, `acquisition_notes`, `project_grant`, `collection_info`, `depositor_info` |
| **Location** | `municipality_or_township`, `county_or_parish`, `state_or_province`, `country_or_territory`, `global_region`, `recording_context` |
| **Books** | `publisher`, `publisher_address`, `isbn`, `loc_catalog_number`, `total_number_of_pages_and_physical_description` |
| **External** | `temporary_accession_number`, `lender_loan_number`, `other_institutional_number` |
| **Deprecated** | `migration_file_format`, `migration_location`, `cataloged_by`, `cataloged_date`, `filemaker_legacy_pk_id` |
| **Migration** | `migrate`, `migrate_display` |
| **Versioning** | `added`, `updated`, `modified_by` |

---

### Collaborator (Person)

**Purpose**: People involved in creating/contributing to materials

**Scale**: 7,400+ collaborators

**Name Architecture**:
- **Component fields**: first_names, nickname, last_names, name_suffix
- **Computed field**: full_name (auto-calculated via signal)
- **Format**: `first_names "nickname" last_names name_suffix`
- **Read-only**: full_name is display-only, users edit components

**Key Fields** (35 total):
- **Identity**: collaborator_id (unique int), full_name (computed), slug (computed)
- **Names**: first_names, nickname, last_names, name_suffix, other_names (array)
- **Demographics**: anonymous (boolean), gender, birth_date, death_date, origin
- **Affiliations**: tribal_affiliations, clan_or_society
- **Computed**: slug (from full_name, base58), item_count (annotated)

**Relationships**:
- **Items** (M2M via CollaboratorRole): With roles and citation flag
- **Documents** (M2M direct)
- **Native Languages** (M2M to Languoid): Languages spoken natively
- **Other Languages** (M2M to Languoid): Non-native languages known

**Signals**:
- `compute_collaborator_derived_fields` (pre_save): full_name, slug, date standardization
- `auto_add_parent_language_for_collaborator_dialects` (m2m_changed): Ensure parent languages present

**Batch Editor**: Production (7,400 rows, 35 fields)

### Collaborator harmonization (2025-11)

**See:** `05-ARCHIVE/collaborator-harmonization-snapshot.md` for narrative. **Dialect / DialectInstance** removed from the schema; see `05-ARCHIVE/deprecated.md`.

- **Name components** are edited in UI; **`full_name`** and related derived values computed in **`pre_save`** signal (`compute_collaborator_derived_fields` in `metadata/signals.py`).
- **Languages:** direct **M2M to Languoid** (`native_languages`, `other_languages`); no custom through table requiring `modified_by`.

---

### Languoid (Language/Dialect)

**Purpose**: Languages and dialects in hierarchical tree

**Scale**: 1,200+ languoids (families, languages, dialects)

**Hierarchy**:
```
Family (e.g., Iroquoian)
  └─ Subfamily (e.g., Northern Iroquoian)
       └─ Language (e.g., Cayuga)
            └─ Dialect (e.g., Upper Cayuga)
```

**Key Fields** (40 total):
- **Identity**: glottocode (unique), name, name_abbrev, iso_639_3
- **Classification**: level_glottolog (family/language/dialect), level_nal (auto)
- **Hierarchy**: parent_languoid (FK self), family_languoid (computed), pri_subgroup_languoid (computed), sec_subgroup_languoid (computed)
- **Geographic**: longitude, latitude, region
- **Cached**: descendents (M2M self), item_count (annotated)

**Hierarchy Computation**:
- **Source of truth**: `parent_languoid` (user edits only this)
- **Derived fields**: level_nal, family_languoid, subgroup FKs (all computed)
- **Signals + Celery**: Complex cascading updates via `update_languoid_hierarchy_task`

**Signals**:
- `compute_languoid_derived_fields` (pre_save): Derive level_nal, hierarchy FKs
- `schedule_languoid_hierarchy_update` (post_save): Trigger async hierarchy maintenance
- `schedule_cascading_dialect_updates` (post_save): Update dialects when family changes

**Level Transitions**:
- **Family with family parent** - Subfamily
- **Family with subfamily parent** - Subsubfamily
- **Language - Non-language**: Orphan dialect children (set parent_languoid = None)

**URL Routing**:
- Languoid detail pages use **glottocode** as URL parameter: `/languoids/{glottocode}/`
- ViewSet `get_object` accepts both glottocode (string) and integer ID (hybrid lookup)
- When saving a glottocode change, use `navigate(..., { replace: true })` to avoid back-button issues

### Glottocode URL implementation (historical)

**Context note (2025-10-28):** Languoid URL and hybrid id/glottocode lookup (React, internal API, templates).

- **Django `urls.py`:** Languoid routes use `<str:pk>` so **glottocode or numeric string** works; template views resolve glottocode-first then ID (`metadata/views.py`).
- **Internal API:** `get_object()` on languoid viewset tries non-numeric as glottocode, else PK (`internal_api/views.py`).
- **React:** Prefer `languoid.glottocode || languoid.id` for links; **never** `parseInt` glottocode strings (yields NaN / 404). API methods accept `string | number` for id (`api.ts`).
- **After editing glottocode:** `navigate('/languoids/${value}', { replace: true })` so history does not stack intermediate URLs.

**Languoid bulk import** (October 2025 data exercise):

- **Command:** `python manage.py import_languoids` (dataset e.g. `languoids.json`).
- **Scale:** 2,418 records imported; **62 pseudo glottocodes** pattern `XXXX0123` (4-char name prefix + increment) when Glottolog code absent.
- **Upsert:** 1,190 existing updated (991 by glottocode match, 199 by name); **1,228** created; **7 orphans** left untouched per the import run policy (recorded in this section).
- **Graph:** Circular reference checks; `parent_languoid` / `descendents` maintained.
- **Schema:** `iso` widened (32→100 chars); `tribes` CharField→TextField; migration module **`0092_alter_languoid_iso_alter_languoid_tribes.py`** (a prior note had a 2027 date error—treat as 2025-era work).
- **Validation (import):** conflict detection, circular refs, field length, FK resolution.

**Batch Editor**: Production (1,200 rows, 40 fields)

---

### Collection (Organizational Grouping)

**Purpose**: Group related items by collection abbreviation

**Scale**: ~10 collections

**Key Fields**:
- **Identity**: collection_abbr (e.g., "ACH", "NAL", "CAR"), collection_name
- **Description**: description, curator, contact info

**Auto-Assignment**:
- Items with catalog_number matching `^([A-Za-z]{3})-` pattern auto-assigned
- Example: "ACH-00123" - ACH collection
- Signal: `update_item_date_ranges` (pre_save on Item)

**Batch Editor**: Not planned (too few rows, simple structure)

---

### Document/File (Digital Asset)

**Purpose**: Actual digital files associated with Items

**Scale**: Unknown (not yet in batch editor focus)

**Key Fields** (estimate):
- **Identity**: filename, file_path
- **Technical**: file_type, file_size, duration, format
- **Metadata**: title, description, access_level, creation_date
- **Relationships**: item (FK), collaborators (M2M), languages (M2M)

**Batch Editor**: Next priority (final in Stage 1)

---

## Relationship Patterns

### Many-to-Many (M2M)

**Direct M2M** (simple junction):
- Collaborator <> Documents
- Item <> Languages
- Languoid <> Languoid (descendents cache)

**M2M with Through-Model** (attributes on relationship):
- Item <> Collaborator via **CollaboratorRole** (roles, citation_author)
- Item <> Title via **ItemTitle** (title text, language, default flag)

**Frontend Patterns**:
- Direct M2M: Multiselect cell type with Autocomplete
- Through-model: Custom cell editor (e.g., CollaboratorRolesCellEditor)

### Foreign Keys (FK)

**Simple FK**:
- Item - Collection (auto-assigned)
- ItemTitle - Languoid (language of title)
- CollaboratorRole - Collaborator

**Self-Referential FK** (hierarchies):
- Languoid - Languoid (parent_languoid for tree structure)

**Frontend Patterns**:
- Dropdown (relationship cell type) with search
- Autocomplete for complex lookups

### Computed Relationships

**Auto-Add Parent Languages**:
- When dialect selected, parent language auto-added (signal: m2m_changed)
- Applies to: Collaborator.native_languages, Collaborator.other_languages, Item.language

**Hierarchy Enforcement**:
- Languoid descendents M2M updated when parent_languoid changes
- Celery task: `update_languoid_hierarchy_task` (Priority 9)

## Field Types

### Text Fields
- **CharField**: Single-line text (catalog_number, name, etc.)
- **TextField**: Multi-line text (description, notes, etc.)
- **ArrayField**: List of strings (other_names, tribes)

### Choice Fields
- **Single choice**: resource_type, access_level, gender, etc.
- **MultiSelectField**: genre, language_description_type, roles, etc.

**API Pattern**: Provide both `field` (value) and `field_display` (label)

### Date Fields
- **Storage**: CharField (flexible text)
- **Formats Accepted**: Years, months, full dates, ranges, approximate ("ca 2023", "1990s?")
- **Standardization**: Signal converts MM/DD/YYYY to YYYY/MM/DD
- **Search**: Computed min/max date fields for range queries

### Numeric Fields
- **DecimalField**: latitude (-90 to 90), longitude (-180 to 180)
- **IntegerField**: collaborator_id, page counts

### Boolean Fields
- **BooleanField with null=True**: 3-state (Yes/No/Not specified)
- **Examples**: anonymous, citation_author (CollaboratorRole); migrate (Item, non-null default False)

### Computed Fields
- **Pre-save signals**: browse_categories, collection, full_name, level_nal
- **Read-only in API**: Included in serializers but not editable

## Database Constraints

**Unique Constraints**:
- Item.catalog_number (enforced at DB and batch editor)
- Collaborator.collaborator_id
- Languoid.glottocode

**Nullable Fields**:
- Most fields nullable (archive data often incomplete)
- Required fields: Item.catalog_number, Languoid.name, Collaborator.collaborator_id

**Cascading Deletes**:
- Item deleted - CollaboratorRole deleted (CASCADE)
- Languoid deleted - Children orphaned (SET_NULL on parent_languoid)

## Deprecated Models

### Content Types

**Purpose**: System handles diverse cultural and linguistic materials with varying sensitivity levels.

**Categories**:

**Linguistic Materials** (Language preservation focus):
- Audio/video recordings (languages, dialects)
- Educational materials
- Linguistic documentation
- Community language resources

**Cultural Materials** (High ceremonial significance):
- Ceremonial recordings (Music: Ceremonial, Music: Native American Church, Music: Sundance)
- Traditional music
- Prayers and spiritual content
- Cultural practice documentation
- Traditional stories

**Historical/Ethnographic**:
- Interviews
- Narratives
- Historical accounts
- Ethnographic documentation

**Published Works**:
- Books and articles
- Theses and dissertations
- Manuscripts
- Research publications

**Visual Materials**:
- Photographs
- Images
- 3D objects
- Ephemera

**Sensitivity Considerations**: Cultural materials (especially ceremonial content) require special access controls and community consultation. See `cultural-context.md` for detailed cultural sensitivity requirements.

---

## Deprecated Models

### Dialect (Removed 2025-11-08)
- Legacy model for dialect names
- Replaced by Languoid with level_glottolog='dialect'
- Migration: 0102_decommission_dialect_models.py

### DialectInstance (Removed 2025-11-08)
- Legacy custom through-model for M2M language relationships
- Required modified_by field made simple operations complex
- Replaced by Django auto-generated M2M through tables
- Stub classes preserved in views.py to prevent legacy code crashes

---

**See also**:
- `../02-PATTERNS/backend.md` - Signal patterns, field validation
- `../03-LESSONS/item-batch-editor.md` - Complex field handling
- `../04-REFERENCE/field-guides/` - Complete field documentation (future)
