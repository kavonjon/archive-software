/**
 * Stage 1: Batch Editing - Spreadsheet Type Definitions
 * 
 * These types define the data structures for the smart spreadsheet interface.
 * Cells display human-friendly text while storing machine-readable values.
 */

/**
 * Validation state for a cell
 */
export type ValidationState = 'valid' | 'invalid' | 'validating';

/**
 * A single cell change for undo/redo history
 */
export interface CellChange {
  rowId: string | number;
  fieldName: string;
  oldValue: any;
  oldText: string;
  newValue: any;
  newText: string;
  oldValidationState?: ValidationState;
  oldValidationError?: string;
}

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
  type: 'single' | 'batch';
  changes: CellChange[];
  timestamp: number;
  description: string; // e.g., "Edit Name" or "Paste 50 cells"
}

/**
 * Cell types supported in the spreadsheet
 */
export type CellType = 
  | 'text'           // Simple text input
  | 'select'         // Single selection from choices
  | 'relationship'   // Foreign key relationship
  | 'multiselect'    // Many-to-many relationships
  | 'boolean'        // Three-state boolean (true/false/null)
  | 'date'           // Date field
  | 'stringarray'    // JSONField string array
  | 'decimal'        // Decimal number field (longitude, latitude, measurements)
  | 'readonly';      // Read-only field (cannot be edited)

/**
 * A single cell in the spreadsheet grid
 * Separates display value (human-friendly) from actual value (machine-readable)
 */
export interface SpreadsheetCell {
  /** Human-friendly display text (e.g., "English, Spanish, French") */
  text: string;
  
  /** Machine-readable value (e.g., [1, 5, 12] for IDs, or "some_value" for text) */
  value: any;
  
  /** Cell type determines how editing works */
  type: CellType;
  
  /** Track if user has edited this cell */
  isEdited: boolean;
  
  /** Original value when loaded from DB (for change detection) */
  originalValue: any;
  
  /** Current validation state */
  validationState: ValidationState;
  
  /** Validation error message if invalid */
  validationError?: string;
  
  /** Conflict detection (cell edited locally but also changed in DB) */
  hasConflict: boolean;
  
  /** Model field name this cell represents */
  fieldName: string;
  
  /** Read-only flag (e.g., for ID fields) */
  readOnly?: boolean;
}

/**
 * A single row in the spreadsheet
 * Represents one model instance (existing or draft)
 */
export interface SpreadsheetRow {
  /** Database ID (number) or "draft-{uuid}" for new rows */
  id: string | number;
  
  /** Map of field name to cell data */
  cells: Record<string, SpreadsheetCell>;
  
  /** True if this is a new row not yet saved to DB */
  isDraft: boolean;
  
  /** True if any cell in this row has been edited */
  hasChanges: boolean;
  
  /** True if any cell has validation errors */
  hasErrors: boolean;
  
  /** True if this row is selected (checkbox) - Phase 9.1 */
  isSelected?: boolean;
  
  /** Version number for optimistic locking (conflict detection) */
  version?: number;
  
  /** DB's 'updated' timestamp for conflict detection */
  _updated?: string;
}

/**
 * Column configuration for the spreadsheet
 * Defines how each model field is displayed and edited
 */
export interface ColumnConfig {
  /** Field name in the model */
  fieldName: string;
  
  /** Human-readable column header */
  header: string;
  
  /** Cell type for this column */
  cellType: CellType;
  
  /** Column width in pixels */
  width?: number;
  
  /** Read-only flag */
  readOnly?: boolean;
  
  /** Required field flag */
  required?: boolean;
  
  /** For select/relationship fields: available choices */
  choices?: Array<{ value: any; label: string }>;
  
  /** For relationship fields: API endpoint to fetch options */
  relationshipEndpoint?: string;
  
  /** Custom validation function */
  validate?: (value: any, row: SpreadsheetRow) => Promise<string | null>;
  
  /** Format function for display value */
  formatDisplay?: (value: any) => string;
  
  /** Parse function to convert user input to value */
  parseInput?: (input: string) => any;
}

/**
 * Configuration for a model-specific batch editor
 */
export interface BatchEditorConfig {
  /** Model name (e.g., "Languoid", "Item") */
  modelName: string;
  
  /** API endpoint for fetching objects */
  listEndpoint: string;
  
  /** API endpoint for saving batch changes */
  saveEndpoint: string;
  
  /** API endpoint for validating cells */
  validateEndpoint: string;
  
  /** Unique identifier field name (e.g., "id", "catalog_number") */
  idField: string;
  
  /** Column configurations */
  columns: ColumnConfig[];
  
  /** Default values for new rows */
  defaultValues?: Record<string, any>;
}

/**
 * State for the batch spreadsheet Redux slice
 */
export interface BatchSpreadsheetState {
  /** Current model being edited */
  modelName: string | null;
  
  /** All rows in the spreadsheet */
  rows: SpreadsheetRow[];
  
  /** Loading state */
  loading: boolean;
  
  /** Saving state */
  saving: boolean;
  
  /** Error message if any */
  error: string | null;
  
  /** Success message after save */
  successMessage: string | null;
  
  /** Cells currently being validated */
  validatingCells: string[]; // Array of "rowId-fieldName" strings
  
  /** Dirty flag (unsaved changes) */
  isDirty: boolean;
  
  /** Undo/Redo History */
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  maxHistorySize: number; // Default: 50 actions
}

