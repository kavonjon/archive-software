/**
 * Collaborator Import Column Mapper
 * 
 * Defines the mapping between Excel/CSV column names and Collaborator batch editor fields.
 * Supports case-insensitive matching with whitespace/underscore normalization.
 */

import { CellType } from '../types/spreadsheet';

export interface ImportColumnConfig {
  /** Batch editor field name (e.g., 'first_names') */
  batchEditorField: string;
  
  /** Cell type for validation and parsing */
  cellType: CellType;
  
  /** Whether this field is required */
  required: boolean;
  
  /** Parser type for transforming raw string values */
  parser?: 'fuzzy_match_choice' | 'comma_separated_list' | 'boolean' | 'languoid_ids' | 'comma_separated_languoids';
  
  /** For select/choice fields: the list of valid choices */
  choices?: Array<{ value: string | boolean | null; label: string }>;
}

/**
 * Normalize column name for case-insensitive, whitespace-agnostic matching
 * Examples:
 *   "First_Names" → "first names"
 *   "  Collaborator ID  " → "collaborator id"
 *   "Native/First Languages" → "native/first languages"
 */
export const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')      // Replace underscores with spaces
    .replace(/\s+/g, ' ');   // Collapse multiple spaces into one
};

/**
 * Column mapping configuration for Collaborators
 * Keys are normalized column names (lowercase, no underscores)
 * 
 * CRITICAL: ALL batch editor columns must be included (except full_name which is computed).
 * Missing columns = changes not detected/applied!
 */
export const COLLABORATOR_IMPORT_COLUMN_MAP: Record<string, ImportColumnConfig> = {
  // ============================================================================
  // IDENTIFIER FIELDS
  // ============================================================================
  
  'collaborator id': {
    batchEditorField: 'collaborator_id',
    cellType: 'text',  // Changed from 'integer' per compilation fix
    required: false,  // Optional - will be auto-generated for new rows
  },
  
  // ============================================================================
  // NAME FIELDS
  // ============================================================================
  
  'first and middle name(s)': {
    batchEditorField: 'first_names',
    cellType: 'text',
    required: false,
  },
  
  'first and middle names': {
    batchEditorField: 'first_names',
    cellType: 'text',
    required: false,
  },
  
  'last name(s)': {
    batchEditorField: 'last_names',
    cellType: 'text',
    required: false,
  },
  
  'last names': {
    batchEditorField: 'last_names',
    cellType: 'text',
    required: false,
  },
  
  'name suffix': {
    batchEditorField: 'name_suffix',
    cellType: 'text',
    required: false,
  },
  
  'suffix': {
    batchEditorField: 'name_suffix',
    cellType: 'text',
    required: false,
  },
  
  'nickname': {
    batchEditorField: 'nickname',
    cellType: 'text',
    required: false,
  },
  
  'other names': {
    batchEditorField: 'other_names',
    cellType: 'stringarray',
    required: false,
    parser: 'comma_separated_list',
  },
  
  // ============================================================================
  // STATUS FIELD
  // ============================================================================
  
  'anonymous': {
    batchEditorField: 'anonymous',
    cellType: 'boolean',
    required: false,
    parser: 'boolean',
    choices: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
      { value: null, label: 'Not specified' },
    ],
  },
  
  // ============================================================================
  // LANGUAGE FIELDS (M2M)
  // ============================================================================
  
  'native/first languages': {
    batchEditorField: 'native_languages',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_languoids',
  },
  
  'native languages': {
    batchEditorField: 'native_languages',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_languoids',
  },
  
  'other languages': {
    batchEditorField: 'other_languages',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_languoids',
  },
  
  // ============================================================================
  // DEMOGRAPHIC FIELDS
  // ============================================================================
  
  'birthdate': {
    batchEditorField: 'birthdate',
    cellType: 'text',  // Date stored as text
    required: false,
  },
  
  'birth date': {
    batchEditorField: 'birthdate',
    cellType: 'text',
    required: false,
  },
  
  'deathdate': {
    batchEditorField: 'deathdate',
    cellType: 'text',  // Date stored as text
    required: false,
  },
  
  'death date': {
    batchEditorField: 'deathdate',
    cellType: 'text',
    required: false,
  },
  
  'gender': {
    batchEditorField: 'gender',
    cellType: 'text',
    required: false,
  },
  
  'tribal affiliations': {
    batchEditorField: 'tribal_affiliations',
    cellType: 'text',
    required: false,
  },
  
  'clan/society': {
    batchEditorField: 'clan_society',
    cellType: 'text',
    required: false,
  },
  
  'clan society': {
    batchEditorField: 'clan_society',
    cellType: 'text',
    required: false,
  },
  
  'origin': {
    batchEditorField: 'origin',
    cellType: 'text',
    required: false,
  },
  
  'other info': {
    batchEditorField: 'other_info',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // IGNORED FIELDS (Calculated/Derivative - Do NOT Import)
  // ============================================================================
  // These are commented out to document what we explicitly ignore:
  //
  // 'full_name' - Calculated by Django signals from name components
  // 'slug' - Auto-generated by Django signals
  // 'uuid' - Auto-generated by Django
  // 'birthdate_min' - Calculated by Django signals
  // 'birthdate_max' - Calculated by Django signals
  // 'deathdate_min' - Calculated by Django signals
  // 'deathdate_max' - Calculated by Django signals
  // 'modified_by' - Set by backend
  // Any other fields not in the batch editor columns
};

/**
 * Get all recognized column names (for error messages)
 */
export const getRecognizedCollaboratorColumnNames = (): string[] => {
  return Object.keys(COLLABORATOR_IMPORT_COLUMN_MAP)
    .filter(key => !key.startsWith('//')) // Exclude comments
    .map(key => {
      // Convert back to human-readable format
      return key
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    });
};

/**
 * Map a raw column name to its import configuration
 * Returns null if column should be ignored
 */
export const mapCollaboratorColumnName = (rawColumnName: string): ImportColumnConfig | null => {
  const normalized = normalizeColumnName(rawColumnName);
  return COLLABORATOR_IMPORT_COLUMN_MAP[normalized] || null;
};

/**
 * Validate that at least one recognized column exists in the file
 */
export const hasValidCollaboratorColumns = (columnNames: string[]): boolean => {
  return columnNames.some(name => mapCollaboratorColumnName(name) !== null);
};

/**
 * Get mapping info for all columns in a file
 */
export interface ColumnMappingInfo {
  original: string;           // Original column name from file
  normalized: string;         // Normalized name
  config: ImportColumnConfig | null; // Config if recognized, null if ignored
}

export const analyzeCollaboratorColumns = (columnNames: string[]): {
  valid: ColumnMappingInfo[];
  ignored: ColumnMappingInfo[];
} => {
  const valid: ColumnMappingInfo[] = [];
  const ignored: ColumnMappingInfo[] = [];
  
  columnNames.forEach(original => {
    const normalized = normalizeColumnName(original);
    const config = COLLABORATOR_IMPORT_COLUMN_MAP[normalized] || null;
    
    const info: ColumnMappingInfo = { original, normalized, config };
    
    if (config) {
      valid.push(info);
    } else {
      ignored.push(info);
    }
  });
  
  return { valid, ignored };
};

