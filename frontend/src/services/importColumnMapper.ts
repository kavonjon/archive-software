/**
 * Import Column Mapper
 * 
 * Defines the mapping between Excel/CSV column names and batch editor fields.
 * Supports case-insensitive matching with whitespace/underscore normalization.
 */

import { CellType } from '../types/spreadsheet';

export interface ImportColumnConfig {
  /** Batch editor field name (e.g., 'parent_languoid') */
  batchEditorField: string;
  
  /** Cell type for validation and parsing */
  cellType: CellType;
  
  /** Whether this field is required */
  required: boolean;
  
  /** Parser type for transforming raw string values */
  parser?: 'fuzzy_match_choice' | 'comma_separated_list' | 'glottocode_to_id' | 'comma_separated_glottocodes';
  
  /** For select/choice fields: the list of valid choices */
  choices?: Array<{ value: string; label: string }>;
}

/**
 * Normalize column name for case-insensitive, whitespace-agnostic matching
 * Examples:
 *   "Parent_Languoid_Glottocode" → "parent languoid glottocode"
 *   "  Alternate Names  " → "alternate names"
 *   "Level (Glottolog)" → "level (glottolog)"
 */
export const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')      // Replace underscores with spaces
    .replace(/\s+/g, ' ');   // Collapse multiple spaces into one
};

/**
 * Column mapping configuration
 * Keys are normalized column names (lowercase, no underscores)
 */
export const IMPORT_COLUMN_MAP: Record<string, ImportColumnConfig> = {
  // ============================================================================
  // BASIC FIELDS
  // ============================================================================
  
  'name': {
    batchEditorField: 'name',
    cellType: 'text',
    required: true,
  },
  
  'name abbreviation': {
    batchEditorField: 'name_abbrev',
    cellType: 'text',
    required: false,
  },
  
  'glottocode': {
    batchEditorField: 'glottocode',
    cellType: 'text',
    required: false,
  },
  
  'iso 639-3': {
    batchEditorField: 'iso',
    cellType: 'text',
    required: false,
  },
  
  'iso': {
    batchEditorField: 'iso',
    cellType: 'text',
    required: false,
  },
  
  'alternate names': {
    batchEditorField: 'alt_names',
    cellType: 'stringarray',
    required: false,
    parser: 'comma_separated_list',
  },
  
  'region': {
    batchEditorField: 'region',
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
  
  'tribes': {
    batchEditorField: 'tribes',
    cellType: 'text',
    required: false,
  },
  
  'notes': {
    batchEditorField: 'notes',
    cellType: 'text',
    required: false,
  },
  
  // ============================================================================
  // SELECT FIELDS (Choices)
  // ============================================================================
  
  'level (glottolog)': {
    batchEditorField: 'level_glottolog',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: [
      { value: 'family', label: 'Family' },
      { value: 'language', label: 'Language' },
      { value: 'dialect', label: 'Dialect' },
    ],
  },
  
  'level': {
    batchEditorField: 'level_glottolog',
    cellType: 'select',
    required: false,
    parser: 'fuzzy_match_choice',
    choices: [
      { value: 'family', label: 'Family' },
      { value: 'language', label: 'Language' },
      { value: 'dialect', label: 'Dialect' },
    ],
  },
  
  // ============================================================================
  // RELATIONSHIP FIELDS (Foreign Keys via Glottocode)
  // ============================================================================
  
  'parent languoid glottocode': {
    batchEditorField: 'parent_languoid',
    cellType: 'relationship',
    required: false,
    parser: 'glottocode_to_id',
  },
  
  // ============================================================================
  // M2M FIELDS (Placeholder for future models)
  // ============================================================================
  
  'language families': {
    batchEditorField: 'families',
    cellType: 'multiselect',
    required: false,
    parser: 'comma_separated_glottocodes',
  },
  
  // ============================================================================
  // IGNORED FIELDS (Calculated/Derivative - Do NOT Import)
  // ============================================================================
  // These are commented out to document what we explicitly ignore:
  //
  // 'level (nal)' - Calculated by Django signals
  // 'parent languoid' - Derivative (abbreviation)
  // 'parent languoid abbreviation' - Derivative
  // 'family' - Derivative
  // 'family abbreviation' - Derivative
  // 'family glottocode' - Derivative
  // 'primary subfamily' - Derivative
  // 'primary subfamily abbreviation' - Derivative
  // 'primary subfamily glottocode' - Derivative
  // 'secondary subfamily' - Derivative
  // 'secondary subfamily abbreviation' - Derivative
  // 'secondary subfamily glottocode' - Derivative
  // Any other fields not in the batch editor columns
};

/**
 * Get all recognized column names (for error messages)
 */
export const getRecognizedColumnNames = (): string[] => {
  return Object.keys(IMPORT_COLUMN_MAP)
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
export const mapColumnName = (rawColumnName: string): ImportColumnConfig | null => {
  const normalized = normalizeColumnName(rawColumnName);
  return IMPORT_COLUMN_MAP[normalized] || null;
};

/**
 * Validate that at least one recognized column exists in the file
 */
export const hasValidColumns = (columnNames: string[]): boolean => {
  return columnNames.some(name => mapColumnName(name) !== null);
};

/**
 * Get mapping info for all columns in a file
 */
export interface ColumnMappingInfo {
  original: string;           // Original column name from file
  normalized: string;         // Normalized name
  config: ImportColumnConfig | null; // Config if recognized, null if ignored
}

export const analyzeColumns = (columnNames: string[]): {
  valid: ColumnMappingInfo[];
  ignored: ColumnMappingInfo[];
} => {
  const valid: ColumnMappingInfo[] = [];
  const ignored: ColumnMappingInfo[] = [];
  
  columnNames.forEach(original => {
    const normalized = normalizeColumnName(original);
    const config = IMPORT_COLUMN_MAP[normalized] || null;
    
    const info: ColumnMappingInfo = { original, normalized, config };
    
    if (config) {
      valid.push(info);
    } else {
      ignored.push(info);
    }
  });
  
  return { valid, ignored };
};

