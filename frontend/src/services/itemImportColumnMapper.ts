/**
 * Item Import Column Mapper
 * 
 * Defines the mapping between Excel/CSV column names and Item batch editor fields.
 * Supports case-insensitive matching with whitespace/underscore normalization.
 */

import { CellType } from '../types/spreadsheet';
import { 
  GENRE_CHOICES, 
  LANGUAGE_DESCRIPTION_TYPE_CHOICES,
  ROLE_CHOICES,
  RESOURCE_TYPE_CHOICES,
  ACCESSION_CHOICES,
  AVAILABILITY_CHOICES,
  CONDITION_CHOICES,
  FORMAT_CHOICES,
} from './api';

export interface ImportColumnConfig {
  /** Batch editor field name (e.g., 'catalog_number') */
  batchEditorField: string;
  
  /** Cell type for validation and parsing */
  cellType: CellType;
  
  /** Whether this field is required */
  required: boolean;
  
  /** Parser type for transforming raw string values */
  parser?: 'fuzzy_match_choice' | 'comma_separated_list' | 'boolean' | 'languoid_ids' | 'comma_separated_languoids' | 'comma_separated_values' | 'comma_separated_values_with_choices' | 'collaborators_with_roles' | 'title_with_language';
  
  /** For select/choice fields: the list of valid choices */
  choices?: Array<{ value: string | boolean | null; label: string }>;
}

/**
 * Normalize column name for case-insensitive, whitespace-agnostic matching
 * Examples:
 *   "Catalog_Number" → "catalog number"
 *   "  Call Number  " → "call number"
 *   "Resource Type" → "resource type"
 */
export const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')      // Replace underscores with spaces
    .replace(/\s+/g, ' ');   // Collapse multiple spaces into one
};

/**
 * Column mapping configuration for Items
 * Keys are normalized column names (lowercase, no underscores)
 * 
 * CRITICAL: ALL batch editor columns must be included (except computed fields).
 * Missing columns = changes not detected/applied!
 */
export const ITEM_IMPORT_COLUMN_MAP: Record<string, ImportColumnConfig> = {
  // ============================================================================
  // CORE IDENTIFICATION & METADATA
  // ============================================================================
  
  'catalog number': {
    batchEditorField: 'catalog_number',
    cellType: 'text',
    required: true,
  },
  
  'access level': {
    batchEditorField: 'item_access_level',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: [
      { value: '1', label: '1 - Open Access' },
      { value: '2', label: '2 - Materials are available to view onsite but no copies may be distributed' },
      { value: '3', label: '3 - Access protected by a time limit' },
      { value: '4', label: '4 - Depositor (or someone else) controls access to the resource' },
    ],
  },
  
  'item access level': {
    batchEditorField: 'item_access_level',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: [
      { value: '1', label: '1 - Open Access' },
      { value: '2', label: '2 - Materials are available to view onsite but no copies may be distributed' },
      { value: '3', label: '3 - Access protected by a time limit' },
      { value: '4', label: '4 - Depositor (or someone else) controls access to the resource' },
    ],
  },
  
  'primary title': {
    batchEditorField: 'primary_title',
    cellType: 'title_with_language',
    required: false,
    parser: 'title_with_language',
  },
  
  'title': {
    batchEditorField: 'primary_title',
    cellType: 'title_with_language',
    required: false,
    parser: 'title_with_language',
  },
  
  'default title': {
    batchEditorField: 'primary_title',
    cellType: 'title_with_language',
    required: false,
    parser: 'title_with_language',
  },
  
  'secondary title': {
    batchEditorField: 'secondary_title',
    cellType: 'title_with_language',
    required: false,
    parser: 'title_with_language',
  },
  
  'first additional title': {
    batchEditorField: 'secondary_title',
    cellType: 'title_with_language',
    required: false,
    parser: 'title_with_language',
  },
  
  'description': {
    batchEditorField: 'description_scope_and_content',
    cellType: 'text',
    required: false,
  },
  
  'description scope and content': {
    batchEditorField: 'description_scope_and_content',
    cellType: 'text',
    required: false,
  },
  
  'resource type': {
    batchEditorField: 'resource_type',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: RESOURCE_TYPE_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'call number': {
    batchEditorField: 'call_number',
    cellType: 'text',
    required: false,
  },
  
  'associated ephemera': {
    batchEditorField: 'associated_ephemera',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // RELATIONSHIPS
  // ============================================================================
  
  'languages': {
    batchEditorField: 'language',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_languoids',
  },
  
  'language': {
    batchEditorField: 'language',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_languoids',
  },
  
  'collaborators': {
    batchEditorField: 'collaborators',
    cellType: 'collaborator_roles',
    required: false,
    parser: 'collaborators_with_roles',
    choices: ROLE_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'collaborators (role, citation)': {
    batchEditorField: 'collaborators',
    cellType: 'collaborator_roles',
    required: false,
    parser: 'collaborators_with_roles',
    choices: ROLE_CHOICES as Array<{ value: string; label: string }>,
  },
  
  // ============================================================================
  // DATES (4 total - all text fields with validation)
  // ============================================================================
  
  'creation date': {
    batchEditorField: 'creation_date',
    cellType: 'text',
    required: false,
  },
  
  'accession date': {
    batchEditorField: 'accession_date',
    cellType: 'text',
    required: false,
  },
  
  'collection date': {
    batchEditorField: 'collection_date',
    cellType: 'text',
    required: false,
  },
  
  'deposit date': {
    batchEditorField: 'deposit_date',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // CONTENT CLASSIFICATION
  // ============================================================================
  
  'genre': {
    batchEditorField: 'genre',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_values_with_choices',
    choices: GENRE_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'language description type': {
    batchEditorField: 'language_description_type',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_values_with_choices',
    choices: LANGUAGE_DESCRIPTION_TYPE_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'permission to publish online': {
    batchEditorField: 'permission_to_publish_online',
    cellType: 'boolean',
    required: false,
    parser: 'boolean',
    choices: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
      { value: null, label: 'Not specified' },
    ],
  },
  
  'access level restrictions': {
    batchEditorField: 'access_level_restrictions',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // ACCESSION & ACQUISITION
  // ============================================================================
  
  'accession number': {
    batchEditorField: 'accession_number',
    cellType: 'text',
    required: false,
  },
  
  'type of accession': {
    batchEditorField: 'type_of_accession',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: ACCESSION_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'acquisition notes': {
    batchEditorField: 'acquisition_notes',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // COLLECTION & COLLECTOR INFO
  // ============================================================================
  
  'collector name': {
    batchEditorField: 'collector_name',
    cellType: 'text',
    required: false,
  },
  
  'collector info': {
    batchEditorField: 'collector_info',
    cellType: 'text',
    required: false,
  },
  
  'collecting notes': {
    batchEditorField: 'collecting_notes',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // DEPOSIT INFO
  // ============================================================================
  
  'depositor name': {
    batchEditorField: 'depositor_name',
    cellType: 'text',
    required: false,
  },
  
  'depositor contact information': {
    batchEditorField: 'depositor_contact_information',
    cellType: 'text',
    required: false,
  },
  
  'project grant': {
    batchEditorField: 'project_grant',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // PHYSICAL CONDITION & AVAILABILITY
  // ============================================================================
  
  'availability status': {
    batchEditorField: 'availability_status',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: AVAILABILITY_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'availability status notes': {
    batchEditorField: 'availability_status_notes',
    cellType: 'text',
    required: false,
  },
  
  'condition': {
    batchEditorField: 'condition',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: CONDITION_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'condition notes': {
    batchEditorField: 'condition_notes',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // FORMAT & TECHNICAL
  // ============================================================================
  
  'original format medium': {
    batchEditorField: 'original_format_medium',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: FORMAT_CHOICES as Array<{ value: string; label: string }>,
  },
  
  'location of original': {
    batchEditorField: 'location_of_original',
    cellType: 'text',
    required: false,
  },
  
  'other institutional number': {
    batchEditorField: 'other_institutional_number',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // CONSERVATION
  // ============================================================================
  
  'conservation recommendation': {
    batchEditorField: 'conservation_recommendation',
    cellType: 'text',
    required: false,
  },
  
  'conservation treatments performed': {
    batchEditorField: 'conservation_treatments_performed',
    cellType: 'text',
    required: false,
  },
  
  'equipment used': {
    batchEditorField: 'equipment_used',
    cellType: 'text',
    required: false,
  },
  
  'software used': {
    batchEditorField: 'software_used',
    cellType: 'text',
    required: false,
  },
  
  'ipm issues': {
    batchEditorField: 'ipm_issues',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // GEOGRAPHIC LOCATION
  // ============================================================================
  
  'municipality or township': {
    batchEditorField: 'municipality_or_township',
    cellType: 'text',
    required: false,
  },
  
  'county or parish': {
    batchEditorField: 'county_or_parish',
    cellType: 'text',
    required: false,
  },
  
  'state or province': {
    batchEditorField: 'state_or_province',
    cellType: 'text',
    required: false,
  },
  
  'country or territory': {
    batchEditorField: 'country_or_territory',
    cellType: 'text',
    required: false,
  },
  
  'global region': {
    batchEditorField: 'global_region',
    cellType: 'text',
    required: false,
  },
  
  'recording context': {
    batchEditorField: 'recording_context',
    cellType: 'text',
    required: false,
  },
  
  'public event': {
    batchEditorField: 'public_event',
    cellType: 'text',
    required: false,
  },
  
  'recorded on': {
    batchEditorField: 'recorded_on',
    cellType: 'text',
    required: false,
  },
  
  'latitude': {
    batchEditorField: 'latitude',
    cellType: 'decimal',
    required: false,
  },
  
  'longitude': {
    batchEditorField: 'longitude',
    cellType: 'decimal',
    required: false,
  },
  
  // ============================================================================
  // PUBLICATION INFO
  // ============================================================================
  
  'publisher': {
    batchEditorField: 'publisher',
    cellType: 'text',
    required: false,
  },
  
  'publisher address': {
    batchEditorField: 'publisher_address',
    cellType: 'text',
    required: false,
  },
  
  'isbn': {
    batchEditorField: 'isbn',
    cellType: 'text',
    required: false,
  },
  
  'loc catalog number': {
    batchEditorField: 'loc_catalog_number',
    cellType: 'text',
    required: false,
  },
  
  'total number of pages and physical description': {
    batchEditorField: 'total_number_of_pages_and_physical_description',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // EXTERNAL REFERENCES
  // ============================================================================
  
  'temporary accession number': {
    batchEditorField: 'temporary_accession_number',
    cellType: 'text',
    required: false,
  },
  
  'lender loan number': {
    batchEditorField: 'lender_loan_number',
    cellType: 'text',
    required: false,
  },
  
  'other information': {
    batchEditorField: 'other_information',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // EXPORT-ONLY / IGNORED ON IMPORT
  // ============================================================================
  
  'collection': {
    batchEditorField: 'collection',
    cellType: 'text',
    required: false,
    // Note: Collection is read-only, calculated from catalog_number
    // Included in mapping so it doesn't show as "unrecognized" in import UI
    // Import logic should skip this field
  },
};

/**
 * Column mapping information for UI display
 */
export interface ColumnMappingInfo {
  original: string;           // Original column name from file
  normalized: string;         // Normalized version for matching
  matched: boolean;           // Whether we found a mapping
  batchEditorField?: string;  // Mapped field name (if matched)
  config?: ImportColumnConfig; // Full config (if matched)
}

/**
 * Map imported column names to batch editor field names
 */
export const mapItemColumnName = (columnName: string): string | null => {
  const normalized = normalizeColumnName(columnName);
  const config = ITEM_IMPORT_COLUMN_MAP[normalized];
  return config ? config.batchEditorField : null;
};

/**
 * Analyze columns from a parsed file
 * Returns info about which columns were matched/ignored
 */
export const analyzeItemColumns = (headers: string[]): {
  valid: ColumnMappingInfo[];
  ignored: ColumnMappingInfo[];
} => {
  const valid: ColumnMappingInfo[] = [];
  const ignored: ColumnMappingInfo[] = [];
  
  for (const header of headers) {
    const normalized = normalizeColumnName(header);
    const config = ITEM_IMPORT_COLUMN_MAP[normalized];
    
    const info: ColumnMappingInfo = {
      original: header,
      normalized,
      matched: !!config,
      batchEditorField: config?.batchEditorField,
      config,
    };
    
    if (config) {
      valid.push(info);
    } else {
      ignored.push(info);
    }
  }
  
  return { valid, ignored };
};

/**
 * Check if file has at least one valid Item column
 * Used for early file validation
 */
export const hasValidItemColumns = (headers: string[]): boolean => {
  return headers.some(header => {
    const normalized = normalizeColumnName(header);
    return !!ITEM_IMPORT_COLUMN_MAP[normalized];
  });
};

