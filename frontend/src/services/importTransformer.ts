/**
 * Import Transformer
 * 
 * Transforms parsed spreadsheet data into batch editor rows with smart duplicate handling.
 * 
 * Key Features:
 * - Glottocode lookup: If glottocode exists in DB or spreadsheet, update that row
 * - Name conflict detection: If name matches existing languoid (no glottocode), add orange warning
 * - Value comparison: Only update cells if values differ (order-insensitive for arrays)
 * - Auto-select: All affected rows (new or modified) are auto-checked
 */

import { SpreadsheetRow, SpreadsheetCell } from '../types/spreadsheet';
import { Languoid } from './api';
import { ParsedSpreadsheetData } from './fileParser';
import {
  mapColumnName,
  ColumnMappingInfo,
  analyzeColumns,
} from './importColumnMapper';
import {
  LanguoidCacheLookup,
  parseLevelGlottolog,
  parseAlternateNames,
  parseGlottocodeToId,
  parseCommaSeparatedGlottocodes,
  areCellValuesEqual,
} from './importValueParsers';
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
  
  /** Name conflicts (name matches existing languoid without glottocode) */
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
 * Transform parsed spreadsheet data into batch editor rows
 */
export const transformImportData = async (
  parsedData: ParsedSpreadsheetData,
  currentRows: SpreadsheetRow[],
  languoidCache: LanguoidCacheLookup
): Promise<ImportResult> => {
  const newRows: SpreadsheetRow[] = [];
  const modifiedRows: Array<{ rowId: string | number; changes: Record<string, { value: any; text: string }> }> = [];
  const unchangedRows: Array<{ rowId: string | number }> = [];
  const nameConflicts: Array<{ rowId: string | number; name: string; existingGlottocode: string }> = [];
  const validationNeeded: Array<{ rowId: string | number; fieldName: string; value: any }> = [];
  
  // Analyze columns
  const columnInfo = analyzeColumns(parsedData.headers);
  
  // Process each row
  for (const rawRow of parsedData.rows) {
    // Step 1: Parse all cell values
    const parsedCells = await parseCellValues(rawRow, columnInfo.valid, languoidCache);
    
    // Step 2: Extract glottocode and name for duplicate detection
    const glottocode = parsedCells['glottocode']?.value;
    const name = parsedCells['name']?.value;
    
    // Step 3: Check if glottocode exists in current spreadsheet
    const existingSpreadsheetRow = glottocode 
      ? currentRows.find(row => row.cells.glottocode?.value === glottocode)
      : null;
    
    // Step 4: Check if glottocode exists in DB
    let dbLanguoid: Languoid | null = null;
    if (glottocode) {
      dbLanguoid = await languoidCache.getByGlottocode(glottocode);
    }
    
    if (existingSpreadsheetRow) {
      // CASE 1: Row already in spreadsheet → Modify if values differ
      const changes = getChangedCells(existingSpreadsheetRow, parsedCells);
      
      if (Object.keys(changes).length > 0) {
        modifiedRows.push({
          rowId: existingSpreadsheetRow.id,
          changes,
        });
        
        // Mark cells for validation
        Object.keys(changes).forEach(fieldName => {
          validationNeeded.push({
            rowId: existingSpreadsheetRow.id,
            fieldName,
            value: changes[fieldName].value,
          });
        });
      } else {
        // No changes, but row was in import → track it for auto-checking
        unchangedRows.push({
          rowId: existingSpreadsheetRow.id,
        });
      }
      
    } else if (dbLanguoid) {
      // CASE 2: Exists in DB but not in spreadsheet → Load from DB, apply changes
      const rowFromDb = languoidToSpreadsheetRow(dbLanguoid);
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
      // CASE 3: New draft row
      const newRow = createDraftRowFromParsedCells(parsedCells);
      newRow.isSelected = true; // Auto-check
      newRows.push(newRow);
      
      // Mark all cells for validation
      Object.keys(parsedCells).forEach(fieldName => {
        validationNeeded.push({
          rowId: newRow.id,
          fieldName,
          value: parsedCells[fieldName].value,
        });
      });
      
      // Check for name conflict (orange warning)
      if (name && !glottocode) {
        const existingByName = await languoidCache.getByName(name);
        if (existingByName) {
          nameConflicts.push({
            rowId: newRow.id,
            name,
            existingGlottocode: existingByName.glottocode,
          });
        }
      }
    }
  }
  
  return {
    newRows,
    modifiedRows,
    unchangedRows,
    nameConflicts,
    validationNeeded,
    columnInfo,
  };
};

/**
 * Parse all cell values from a single spreadsheet row
 */
const parseCellValues = async (
  rawRow: Record<string, string>,
  validColumns: ColumnMappingInfo[],
  languoidCache: LanguoidCacheLookup
): Promise<Record<string, { value: any; text: string; cellType: string }>> => {
  const result: Record<string, { value: any; text: string; cellType: string }> = {};
  
  for (const columnInfo of validColumns) {
    const { original, config } = columnInfo;
    if (!config) continue;
    
    const rawValue = rawRow[original];
    const fieldName = config.batchEditorField;
    const cellType = config.cellType;
    
    // Parse based on cell type
    let value: any;
    let text: string;
    
    switch (config.parser) {
      case 'fuzzy_match_choice':
        // Level (Glottolog)
        value = parseLevelGlottolog(rawValue);
        text = value || '';
        break;
      
      case 'comma_separated_list':
        // Alternate Names (stringarray)
        value = parseAlternateNames(rawValue);
        text = value.join(', ');
        break;
      
      case 'glottocode_to_id':
        // Parent Languoid (relationship)
        const relationshipResult = await parseGlottocodeToId(rawValue, languoidCache);
        value = relationshipResult.id;
        text = relationshipResult.text;
        break;
      
      case 'comma_separated_glottocodes':
        // Language Families (multiselect) - placeholder for future M2M
        const multiSelectResult = await parseCommaSeparatedGlottocodes(rawValue, languoidCache);
        value = multiSelectResult.ids;
        text = multiSelectResult.text;
        break;
      
      default:
        // Plain text (name, glottocode, iso)
        // Django CharField expects empty string, not null
        value = rawValue.trim() || '';
        text = rawValue.trim();
    }
    
    result[fieldName] = { value, text, cellType };
  }
  
  return result;
};

/**
 * Get changed cells (only include if value differs)
 */
const getChangedCells = (
  existingRow: SpreadsheetRow,
  parsedCells: Record<string, { value: any; text: string; cellType: string }>
): Record<string, { value: any; text: string }> => {
  const changes: Record<string, { value: any; text: string }> = {};
  
  for (const [fieldName, parsedCell] of Object.entries(parsedCells)) {
    const existingCell = existingRow.cells[fieldName];
    const existingValue = existingCell?.value;
    const newValue = parsedCell.value;
    
    if (!areCellValuesEqual(existingValue, newValue, parsedCell.cellType)) {
      changes[fieldName] = { value: newValue, text: parsedCell.text };
    }
  }
  
  return changes;
};

/**
 * Convert Languoid (from DB) to SpreadsheetRow
 * 
 * IMPORTANT: This should match the format created by languoidToRow() in LanguoidBatchEditor.tsx
 * For now, this is a simplified version that only includes core fields.
 * When the row is added to the batch editor, it will be populated with all fields.
 * 
 * TODO: Consider importing and using the actual languoidToRow function to ensure consistency.
 */
const languoidToSpreadsheetRow = (languoid: Languoid): SpreadsheetRow => {
  // Create cells for all possible fields to match LanguoidBatchEditor's structure
  const cells: Record<string, SpreadsheetCell> = {
    name: {
      value: languoid.name,
      text: languoid.name,
      type: 'text',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.name,
      hasConflict: false,
      fieldName: 'name',
    },
    name_abbrev: {
      value: languoid.name_abbrev || '',
      text: languoid.name_abbrev || '',
      type: 'text',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.name_abbrev || '',
      hasConflict: false,
      fieldName: 'name_abbrev',
    },
    glottocode: {
      value: languoid.glottocode,
      text: languoid.glottocode,
      type: 'text',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.glottocode,
      hasConflict: false,
      fieldName: 'glottocode',
    },
    iso: {
      value: languoid.iso || '',
      text: languoid.iso || '',
      type: 'text',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.iso || '',
      hasConflict: false,
      fieldName: 'iso',
    },
    level_glottolog: {
      value: languoid.level_glottolog,
      text: languoid.level_display || languoid.level_glottolog,
      type: 'select',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.level_glottolog,
      hasConflict: false,
      fieldName: 'level_glottolog',
    },
    alt_names: {
      value: languoid.alt_names || [],
      text: Array.isArray(languoid.alt_names) ? languoid.alt_names.join(', ') : '',
      type: 'stringarray',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.alt_names || [],
      hasConflict: false,
      fieldName: 'alt_names',
    },
    parent_languoid: {
      value: languoid.parent_languoid || null,
      text: languoid.parent_languoid 
        ? `${languoid.parent_name || ''} (${languoid.parent_glottocode || ''})`
        : '',
      type: 'relationship',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.parent_languoid || null,
      hasConflict: false,
      fieldName: 'parent_languoid',
    },
    region: {
      value: languoid.region || '',
      text: languoid.region || '',
      type: 'text',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.region || '',
      hasConflict: false,
      fieldName: 'region',
    },
    longitude: {
      value: languoid.longitude !== null && languoid.longitude !== undefined ? String(languoid.longitude) : '',
      text: languoid.longitude !== null && languoid.longitude !== undefined ? String(languoid.longitude) : '',
      type: 'decimal',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.longitude !== null && languoid.longitude !== undefined ? String(languoid.longitude) : '',
      hasConflict: false,
      fieldName: 'longitude',
    },
    latitude: {
      value: languoid.latitude !== null && languoid.latitude !== undefined ? String(languoid.latitude) : '',
      text: languoid.latitude !== null && languoid.latitude !== undefined ? String(languoid.latitude) : '',
      type: 'decimal',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.latitude !== null && languoid.latitude !== undefined ? String(languoid.latitude) : '',
      hasConflict: false,
      fieldName: 'latitude',
    },
    tribes: {
      value: languoid.tribes || '',
      text: languoid.tribes || '',
      type: 'text',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.tribes || '',
      hasConflict: false,
      fieldName: 'tribes',
    },
    notes: {
      value: languoid.notes || '',
      text: languoid.notes || '',
      type: 'text',
      validationState: 'valid',
      isEdited: false,
      originalValue: languoid.notes || '',
      hasConflict: false,
      fieldName: 'notes',
    },
  };

  return {
    id: languoid.id,
    isDraft: false,
    isSelected: false,
    hasChanges: false,
    hasErrors: false,
    cells,
    _updated: languoid.updated, // Store DB timestamp for conflict detection
  };
};

/**
 * Create a new draft row from parsed cells
 */
const createDraftRowFromParsedCells = (
  parsedCells: Record<string, { value: any; text: string; cellType: string }>
): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  for (const [fieldName, parsedCell] of Object.entries(parsedCells)) {
    cells[fieldName] = {
      value: parsedCell.value,
      text: parsedCell.text,
      type: parsedCell.cellType as any,
      validationState: 'valid', // Will be validated after import
      isEdited: false,
      originalValue: null, // Draft rows have no original value
      hasConflict: false,
      fieldName: fieldName,
    };
  }
  
  return {
    id: `draft-${uuidv4()}`,
    isDraft: true,
    isSelected: false,
    hasChanges: false,
    hasErrors: false,
    cells,
  };
};

/**
 * Apply changes to an existing row
 */
const applyChangesToRow = (
  row: SpreadsheetRow,
  changes: Record<string, { value: any; text: string }>
): SpreadsheetRow => {
  const updatedRow: SpreadsheetRow = {
    ...row,
    hasChanges: true,
  };
  
  updatedRow.cells = { ...row.cells };
  
  for (const [fieldName, change] of Object.entries(changes)) {
    const existingCell = row.cells[fieldName];
    updatedRow.cells[fieldName] = {
      ...existingCell,
      value: change.value,
      text: change.text,
      isEdited: true,
      validationState: 'valid', // Will be validated after import
    };
  }
  
  return updatedRow;
};

