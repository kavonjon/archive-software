/**
 * Collaborator Import Transformer
 * 
 * Transforms parsed spreadsheet data into Collaborator batch editor rows with smart duplicate handling.
 * 
 * Key Features:
 * - Exact collaborator_id lookup: If collaborator_id exists in DB or spreadsheet, update that row
 * - Name matching: If no collaborator_id, match on exact first_names + last_names + name_suffix
 * - Auto-generate IDs for new rows: New collaborators get auto-generated IDs (ignoring imported ID to prevent conflicts)
 * - Value comparison: Only update cells if values differ (order-insensitive for arrays)
 * - Auto-select: All affected rows (new or modified) are auto-checked
 */

import { SpreadsheetRow, SpreadsheetCell, CellType } from '../types/spreadsheet';
import { Collaborator, collaboratorsAPI } from './api';
import { ParsedSpreadsheetData } from './fileParser';
import {
  mapCollaboratorColumnName,
  ColumnMappingInfo,
  analyzeCollaboratorColumns,
} from './collaboratorImportColumnMapper';
import {
  CollaboratorCacheLookup,
  parseCollaboratorBoolean,
  parseOtherNames,
  parseCommaSeparatedLanguoids,
  areCellValuesEqual,
} from './collaboratorImportValueParsers';
import { v4 as uuidv4 } from 'uuid';

export interface ImportResult {
  /** New draft rows to append */
  newRows: SpreadsheetRow[];
  
  /** Existing rows to modify */
  modifiedRows: Array<{
    rowId: string | number;
    changes: Record<string, { value: any; text: string }>;
  }>;
  
  /** Existing rows that were in the import but had no changes (should still be checked) */
  unchangedRows: Array<{
    rowId: string | number;
  }>;
  
  /** Name conflicts (for Languoids) - not used for Collaborators, kept for interface compatibility */
  nameConflicts: Array<{
    rowId: string | number;
    name: string;
    existingGlottocode: string;
  }>;
  
  /** Cells that need backend validation */
  validationNeeded: Array<{
    rowId: string | number;
    fieldName: string;
    value: any;
  }>;
  
  /** Column mapping info */
  columnInfo: {
    valid: ColumnMappingInfo[];
    ignored: ColumnMappingInfo[];
  };
}

/**
 * Transform parsed spreadsheet data into Collaborator batch editor rows
 */
export const transformCollaboratorImportData = async (
  parsedData: ParsedSpreadsheetData,
  currentRows: SpreadsheetRow[],
  collaboratorCache: CollaboratorCacheLookup
): Promise<ImportResult> => {
  const newRows: SpreadsheetRow[] = [];
  const modifiedRows: Array<{ rowId: string | number; changes: Record<string, { value: any; text: string }> }> = [];
  const unchangedRows: Array<{ rowId: string | number }> = [];
  const validationNeeded: Array<{ rowId: string | number; fieldName: string; value: any }> = [];
  
  // Analyze columns
  const columnInfo = analyzeCollaboratorColumns(parsedData.headers);
  
  // Pre-calculate the starting collaborator_id for new rows
  // This ensures each new row gets an incrementing unique ID
  let nextCollaboratorId: number | null = null;
  try {
    const response = await collaboratorsAPI.getNextId();
    let dbMaxId = response.next_id;
    
    // Check max ID in currentRows (existing DB rows)
    const maxIdInCurrentRows = currentRows.reduce((max, row) => {
      const cellValue = row.cells.collaborator_id?.value;
      const id = typeof cellValue === 'number' ? cellValue : (typeof cellValue === 'string' ? parseInt(cellValue, 10) : null);
      return id && !isNaN(id) && id > max ? id : max;
    }, 0);
    
    // Use whichever is highest
    nextCollaboratorId = Math.max(dbMaxId, maxIdInCurrentRows);
    
    console.log('[CollaboratorImport] Starting collaborator_id for new rows:', nextCollaboratorId, 
                '(DB max:', dbMaxId, ', CurrentRows max:', maxIdInCurrentRows, ')');
  } catch (error) {
    console.error('[CollaboratorImport] Failed to fetch starting collaborator_id:', error);
    // Will be null - backend will assign on save
  }
  
  // Process each row
  for (const rawRow of parsedData.rows) {
    // Step 1: Parse all cell values
    const parsedCells = await parseCellValues(rawRow, columnInfo.valid, collaboratorCache);
    
    // Step 2: Extract collaborator_id and name fields for duplicate detection
    const collaborator_id = parsedCells['collaborator_id']?.value;
    const first_names = parsedCells['first_names']?.value || '';
    const last_names = parsedCells['last_names']?.value || '';
    const name_suffix = parsedCells['name_suffix']?.value || '';
    
    let existingRow: SpreadsheetRow | null = null;
    
    // Step 3: Check if collaborator_id exists in current spreadsheet (exact match)
    if (collaborator_id) {
      existingRow = currentRows.find(row => 
        String(row.cells.collaborator_id?.value) === String(collaborator_id)
      ) || null;
    }
    
    // Step 4: If no collaborator_id match, try name matching (exact first_names + last_names + name_suffix)
    if (!existingRow && (first_names || last_names)) {
      existingRow = currentRows.find(row => 
        String(row.cells.first_names?.value || '').trim().toLowerCase() === first_names.trim().toLowerCase() &&
        String(row.cells.last_names?.value || '').trim().toLowerCase() === last_names.trim().toLowerCase() &&
        String(row.cells.name_suffix?.value || '').trim().toLowerCase() === name_suffix.trim().toLowerCase()
      ) || null;
    }
    
    // Step 5: Check if collaborator_id exists in DB
    let dbCollaborator: Collaborator | null = null;
    if (collaborator_id) {
      dbCollaborator = await collaboratorCache.getByCollaboratorId(Number(collaborator_id));
    }
    
    // Step 6: If no collaborator_id match in DB, try name matching
    if (!dbCollaborator && (first_names || last_names)) {
      dbCollaborator = await collaboratorCache.getByName(first_names, last_names, name_suffix);
    }
    
    if (existingRow) {
      // CASE 1: Row already in spreadsheet → Modify if values differ
      const changes = getChangedCells(existingRow, parsedCells);
      
      if (Object.keys(changes).length > 0) {
        modifiedRows.push({
          rowId: existingRow.id,
          changes,
        });
        
        // Mark cells for validation
        Object.keys(changes).forEach(fieldName => {
          validationNeeded.push({
            rowId: existingRow!.id,  // Non-null assertion: we're inside if(existingRow) block
            fieldName,
            value: changes[fieldName].value,
          });
        });
      } else {
        // No changes, but row was in import → track it for auto-checking
        unchangedRows.push({
          rowId: existingRow.id,
        });
      }
      
    } else if (dbCollaborator) {
      // CASE 2: Exists in DB but not in spreadsheet → Load from DB, apply changes
      const rowFromDb = collaboratorToSpreadsheetRow(dbCollaborator);
      const changes = getChangedCells(rowFromDb, parsedCells);
      
      if (Object.keys(changes).length > 0) {
        // Apply changes to DB row
        const updatedRow = applyChangesToRow(rowFromDb, changes);
        updatedRow.isSelected = true; // Auto-check
        newRows.push(updatedRow);
        
        // Mark cells for validation
        Object.keys(changes).forEach(fieldName => {
          validationNeeded.push({
            rowId: updatedRow.id,
            fieldName,
            value: changes[fieldName].value,
          });
        });
      } else {
        // No changes needed, but still add row and check it
        rowFromDb.isSelected = true;
        newRows.push(rowFromDb);
      }
      
    } else {
      // CASE 3: New collaborator (doesn't exist anywhere) → Create draft row with auto-generated ID
      // Note: We ignore the collaborator_id from the import file to prevent conflicts
      // and generate a fresh ID using the same logic as "Add Row"
      
      // Increment nextCollaboratorId for this new row
      if (nextCollaboratorId !== null) {
        nextCollaboratorId++;
      }
      
      const draftRow = await createDraftRowFromParsedCells(parsedCells, nextCollaboratorId);
      draftRow.isSelected = true; // Auto-check
      newRows.push(draftRow);
      
      // Mark all cells for validation
      Object.keys(parsedCells).forEach(fieldName => {
        validationNeeded.push({
          rowId: draftRow.id,
          fieldName,
          value: parsedCells[fieldName].value,
        });
      });
      
      // Also validate the auto-generated collaborator_id
      if (draftRow.cells.collaborator_id?.value) {
        validationNeeded.push({
          rowId: draftRow.id,
          fieldName: 'collaborator_id',
          value: draftRow.cells.collaborator_id.value,
        });
      }
    }
  }
  
  return {
    newRows,
    modifiedRows,
    unchangedRows,
    nameConflicts: [],  // Not used for Collaborators
    validationNeeded,
    columnInfo,
  };
};

/**
 * Parse cell values from raw row data
 */
const parseCellValues = async (
  rawRow: Record<string, string>,
  validColumns: ColumnMappingInfo[],
  collaboratorCache: CollaboratorCacheLookup
): Promise<Record<string, { value: any; text: string }>> => {
  const parsedCells: Record<string, { value: any; text: string }> = {};
  
  for (const colInfo of validColumns) {
    if (!colInfo.config) continue;
    
    const rawValue = rawRow[colInfo.original];
    const fieldName = colInfo.config.batchEditorField;
    
    // Skip empty values
    if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
      // Store appropriate empty value based on cell type
      if (colInfo.config.cellType === 'stringarray' || colInfo.config.cellType === 'multiselect') {
        parsedCells[fieldName] = { value: [], text: '' };
      } else if (colInfo.config.cellType === 'boolean') {
        parsedCells[fieldName] = { value: null, text: 'Not specified' };
      } else {
        parsedCells[fieldName] = { value: '', text: '' };
      }
      continue;
    }
    
    // Parse based on parser type
    let value: any;
    let text: string;
    
    switch (colInfo.config.parser) {
      case 'boolean':
        const boolResult = parseCollaboratorBoolean(rawValue);
        value = boolResult.value;
        text = boolResult.text;
        break;
        
      case 'comma_separated_list':
        const listResult = parseOtherNames(rawValue);
        value = listResult.value;
        text = listResult.text;
        break;
        
      case 'comma_separated_languoids':
        const languoidsResult = await parseCommaSeparatedLanguoids(rawValue, collaboratorCache);
        value = languoidsResult.value;
        text = languoidsResult.text;
        break;
        
      default:
        // Plain text/number
        value = rawValue.trim();
        text = rawValue.trim();
    }
    
    parsedCells[fieldName] = { value, text };
  }
  
  return parsedCells;
};

/**
 * Get cells that have changed between existing row and parsed cells
 */
const getChangedCells = (
  existingRow: SpreadsheetRow,
  parsedCells: Record<string, { value: any; text: string }>
): Record<string, { value: any; text: string }> => {
  const changes: Record<string, { value: any; text: string }> = {};
  
  for (const fieldName in parsedCells) {
    const existingCell = existingRow.cells[fieldName];
    const newValue = parsedCells[fieldName].value;
    const existingValue = existingCell?.value;
    
    if (!areCellValuesEqual(existingValue, newValue)) {
      changes[fieldName] = parsedCells[fieldName];
    }
  }
  
  return changes;
};

/**
 * Apply changes to a row
 */
const applyChangesToRow = (
  row: SpreadsheetRow,
  changes: Record<string, { value: any; text: string }>
): SpreadsheetRow => {
  const updatedRow = { ...row };
  updatedRow.cells = { ...row.cells };
  updatedRow.hasChanges = true;
  
  for (const fieldName in changes) {
    const originalCell = row.cells[fieldName];
    updatedRow.cells[fieldName] = {
      text: changes[fieldName].text,
      value: changes[fieldName].value,
      type: originalCell?.type || 'text',  // Preserve original type if available
      isEdited: true,
      originalValue: originalCell?.originalValue ?? originalCell?.value ?? '',
      validationState: 'validating',
      hasConflict: false,
      fieldName: fieldName,
    };
  }
  
  return updatedRow;
};

/**
 * Create a draft row from parsed cells with auto-generated collaborator_id
 * 
 * For new collaborators, we ignore the collaborator_id from the import file
 * and use the provided auto-generated ID. This prevents ID conflicts and ensures uniqueness.
 * 
 * @param parsedCells - Cell values parsed from the import file
 * @param collaboratorId - The pre-calculated, auto-generated collaborator_id
 */
const createDraftRowFromParsedCells = async (
  parsedCells: Record<string, { value: any; text: string }>,
  collaboratorId: number | null
): Promise<SpreadsheetRow> => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  // Create cells from parsed data, but override collaborator_id with our generated value
  for (const fieldName in parsedCells) {
    // Skip collaborator_id - we'll set it separately
    if (fieldName === 'collaborator_id') {
      continue;
    }
    
    cells[fieldName] = {
      text: parsedCells[fieldName].text,
      value: parsedCells[fieldName].value,
      type: 'text',  // Default type for new draft rows
      isEdited: true,
      originalValue: '',
      validationState: 'validating',
      hasConflict: false,
      fieldName: fieldName,
    };
  }
  
  // Set the auto-generated collaborator_id
  cells['collaborator_id'] = {
    text: collaboratorId?.toString() || '',
    value: collaboratorId,
    type: 'text',
    isEdited: false,  // Not edited by user - auto-generated
    originalValue: '',
    validationState: 'validating',
    hasConflict: false,
    fieldName: 'collaborator_id',
  };
  
  console.log('[CollaboratorImport] Created draft row with collaborator_id:', collaboratorId);
  
  return {
    id: `draft-${uuidv4()}`,
    cells,
    hasChanges: true,
    hasErrors: false,
    isSelected: false,
    isDraft: true,
  };
};

/**
 * Convert a Collaborator API object to a SpreadsheetRow
 * This must match the logic in CollaboratorBatchEditor.tsx
 * 
 * NOTE: This is a simplified version. For production imports that pull existing
 * collaborators from the DB, consider importing the actual collaboratorToRow 
 * function from CollaboratorBatchEditor.tsx to ensure perfect parity.
 */
const collaboratorToSpreadsheetRow = (collaborator: Collaborator): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  // Map field names to their cell types
  const fieldTypeMap: Record<string, CellType> = {
    'collaborator_id': 'text',
    'first_names': 'text',
    'last_names': 'text',
    'name_suffix': 'text',
    'nickname': 'text',
    'other_names': 'stringarray',
    'anonymous': 'boolean',
    'native_languages': 'multiselect',
    'other_languages': 'multiselect',
    'birthdate': 'text',
    'deathdate': 'text',
    'gender': 'text',
    'tribal_affiliations': 'text',
    'clan_society': 'text',
    'origin': 'text',
    'other_info': 'text',
  };
  
  Object.keys(fieldTypeMap).forEach(fieldName => {
    const value = (collaborator as any)[fieldName];
    let displayValue = value?.toString() || '';
    
    // Handle special cases for display
    if (fieldName === 'anonymous') {
      if (value === null || value === undefined) {
        displayValue = 'Not specified';
      } else {
        displayValue = value ? 'Yes' : 'No';
      }
    } else if (fieldName === 'other_names' && Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if ((fieldName === 'native_languages' || fieldName === 'other_languages') && Array.isArray(value)) {
      displayValue = value.map((lang: any) => lang.name).join(', ');
    }
    
    cells[fieldName] = {
      text: displayValue,
      value: value ?? (Array.isArray(value) ? [] : ''),  // Use ?? instead of || to preserve false/0
      type: fieldTypeMap[fieldName],
      isEdited: false,
      originalValue: value ?? (Array.isArray(value) ? [] : ''),  // Use ?? instead of || to preserve false/0
      validationState: 'valid',
      hasConflict: false,
      fieldName: fieldName,
    };
  });
  
  return {
    id: collaborator.id,
    cells,
    hasChanges: false,
    hasErrors: false,
    isSelected: false,
    isDraft: false,
  };
};

