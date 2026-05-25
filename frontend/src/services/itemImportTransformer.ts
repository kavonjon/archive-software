/**
 * Item Import Transformer
 * 
 * Transforms parsed spreadsheet data into Item batch editor rows with smart duplicate handling.
 * 
 * Key Features:
 * - Exact catalog_number lookup: If catalog_number exists in DB or spreadsheet, update that row
 * - Value comparison: Only update cells if values differ (order-insensitive for arrays)
 * - Auto-select: All affected rows (new or modified) are auto-checked
 * 
 * Note: Collaborators field (complex through model) requires custom handling and is currently simplified
 */

import { SpreadsheetRow, SpreadsheetCell, CellType } from '../types/spreadsheet';
import { Item, itemsAPI } from './api';
import { ParsedSpreadsheetData } from './fileParser';
import {
  mapItemColumnName,
  ColumnMappingInfo,
  analyzeItemColumns,
} from './itemImportColumnMapper';
import {
  ItemCacheLookup,
  parseCommaSeparatedLanguoids,
  parseSelectChoice,
  parseBoolean,
  parseCommaSeparatedValues,
  areCellValuesEqual,
  parseCollaboratorsWithRoles,
  parseTitleWithLanguage,
} from './itemImportValueParsers';
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
  
  /** Name conflicts - not used for Items, kept for interface compatibility */
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
    error?: string; // Optional error message for parser errors
  }>;
  
  /** Column mapping info */
  columnInfo: {
    valid: ColumnMappingInfo[];
    ignored: ColumnMappingInfo[];
  };
}

/**
 * Transform parsed spreadsheet data into Item batch editor rows
 */
export const transformItemImportData = async (
  parsedData: ParsedSpreadsheetData,
  currentRows: SpreadsheetRow[],
  itemCache: ItemCacheLookup
): Promise<ImportResult> => {
  const newRows: SpreadsheetRow[] = [];
  const modifiedRows: Array<{ rowId: string | number; changes: Record<string, { value: any; text: string }> }> = [];
  const unchangedRows: Array<{ rowId: string | number }> = [];
  const validationNeeded: Array<{ rowId: string | number; fieldName: string; value: any; error?: string }> = [];
  
  // Analyze columns
  const columnInfo = analyzeItemColumns(parsedData.headers);
  
  // Process each row
  for (const rawRow of parsedData.rows) {
    // Step 1: Parse all cell values
    const parsedCells = await parseCellValues(rawRow, columnInfo.valid, itemCache, validationNeeded);
    
    // Step 2: Extract catalog_number for duplicate detection
    const catalog_number = parsedCells['catalog_number']?.value;
    
    if (!catalog_number) {
      // Skip rows without catalog_number (required field)
      console.warn('[ItemImport] Skipping row without catalog_number');
      continue;
    }
    
    let existingRow: SpreadsheetRow | null = null;
    
    // Step 3: Check if catalog_number exists in current spreadsheet (exact match)
    existingRow = currentRows.find(row => 
      String(row.cells.catalog_number?.value) === String(catalog_number)
    ) || null;
    
    // Step 4: Check if catalog_number exists in DB
    let dbItem: Item | null = null;
    if (!existingRow) {
      dbItem = await itemCache.getByCatalogNumber(String(catalog_number));
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
            rowId: existingRow!.id,
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
      
    } else if (dbItem) {
      // CASE 2: Exists in DB but not in spreadsheet → Load from DB, apply changes
      const rowFromDb = itemToSpreadsheetRow(dbItem);
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
      // CASE 3: New item (doesn't exist anywhere) → Create draft row
      const draftRow = await createDraftRowFromParsedCells(parsedCells);
      draftRow.isSelected = true; // Auto-check
      newRows.push(draftRow);
      
      // Update rowId for any pending validation errors (from parsers)
      validationNeeded.forEach(v => {
        if (v.rowId === 'pending') {
          v.rowId = draftRow.id;
        }
      });
      
      // Mark all cells for validation (skip cells that already have parser errors)
      Object.keys(parsedCells).forEach(fieldName => {
        // Check if this field already has a parser error
        const hasParserError = validationNeeded.some(v => 
          v.rowId === draftRow.id && v.fieldName === fieldName && v.error
        );
        
        if (!hasParserError) {
          validationNeeded.push({
            rowId: draftRow.id,
            fieldName,
            value: parsedCells[fieldName].value,
          });
        }
      });
    }
  }
  
  return {
    newRows,
    modifiedRows,
    unchangedRows,
    nameConflicts: [],  // Not used for Items
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
  itemCache: ItemCacheLookup,
  validationNeeded: Array<{ rowId: string | number; fieldName: string; value: any; error?: string }>
): Promise<Record<string, { value: any; text: string }>> => {
  const parsedCells: Record<string, { value: any; text: string }> = {};
  
  for (const colInfo of validColumns) {
    if (!colInfo.config) continue;

    // Export-only columns (e.g. Collection abbr) — not in batch grid; FK set on save via pre_save signal
    if (colInfo.config.skipImport) continue;
    
    const rawValue = rawRow[colInfo.original];
    const fieldName = colInfo.config.batchEditorField;
    
    // Skip empty values
    if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
      // Store appropriate empty value based on cell type
      if (colInfo.config.cellType === 'multiselect' || colInfo.config.cellType === 'collaborator_roles') {
        parsedCells[fieldName] = { value: [], text: '' };
      } else if (colInfo.config.cellType === 'title_with_language') {
        parsedCells[fieldName] = { value: null, text: '' };
      } else {
        parsedCells[fieldName] = { value: '', text: '' };
      }
      continue;
    }
    
    // Parse based on parser type
    let value: any;
    let text: string;
    let errors: string[] | undefined;
    
    switch (colInfo.config.parser) {
      case 'fuzzy_match_choice':
        const choiceResult = parseSelectChoice(rawValue, colInfo.config.choices || []);
        value = choiceResult.value;
        text = choiceResult.text;
        break;
        
      case 'comma_separated_languoids':
        const languoidsResult = await parseCommaSeparatedLanguoids(rawValue, itemCache);
        value = languoidsResult.value;
        text = languoidsResult.text;
        errors = languoidsResult.errors;
        break;
        
      case 'boolean':
        const boolResult = parseBoolean(rawValue);
        value = boolResult.value;
        text = boolResult.text;
        break;
        
      case 'comma_separated_values':
        // Plain comma-separated values (no choices)
        const csvResult = parseCommaSeparatedValues(rawValue);
        value = csvResult.value;
        text = csvResult.text;
        break;
        
      case 'comma_separated_values_with_choices':
        // Comma-separated values with choice mapping
        const csvChoicesResult = parseCommaSeparatedValues(rawValue, colInfo.config.choices as Array<{ value: string; label: string }> | undefined);
        value = csvChoicesResult.value;
        text = csvChoicesResult.text;
        errors = csvChoicesResult.errors;
        break;
        
      case 'collaborators_with_roles':
        const collabResult = await parseCollaboratorsWithRoles(rawValue, itemCache, colInfo.config.choices as Array<{ value: string; label: string }> || []);
        value = collabResult.value;
        text = collabResult.text;
        errors = collabResult.errors;
        break;
        
      case 'title_with_language':
        const titleResult = await parseTitleWithLanguage(rawValue, itemCache);
        value = titleResult.value;
        text = titleResult.text;
        errors = titleResult.errors;
        break;
        
      default:
        // Plain text (including date fields)
        value = rawValue.trim();
        text = rawValue.trim();
    }
    
    parsedCells[fieldName] = { value, text };
    
    // Track errors for validation - mark cell as invalid if parser returned errors
    if (errors && errors.length > 0) {
      console.warn(`[ItemImport] Parse errors for ${fieldName}:`, errors);
      // Mark this cell for red highlighting with error message
      validationNeeded.push({
        rowId: 'pending', // Will be set after row is created
        fieldName,
        value: null, // Invalid value
        error: errors.join('; '), // Combine multiple errors
      });
    }
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
      type: originalCell?.type || 'text',
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
 * Create a draft row from parsed cells
 */
const createDraftRowFromParsedCells = async (
  parsedCells: Record<string, { value: any; text: string }>
): Promise<SpreadsheetRow> => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  // Map field names to their cell types (matching ITEM_COLUMNS in ItemBatchEditor)
  const fieldTypeMap: Record<string, CellType> = {
    // Core
    'catalog_number': 'text',
    'item_access_level': 'select',
    'primary_title': 'title_with_language',
    'secondary_title': 'title_with_language',
    'description_scope_and_content': 'text',
    'resource_type': 'select',
    'call_number': 'text',
    'associated_ephemera': 'text',
    // Relationships
    'language': 'multiselect',
    'collaborators': 'collaborator_roles',
    // Dates
    'creation_date': 'text',
    'accession_date': 'text',
    'collection_date': 'text',
    'deposit_date': 'text',
    // Content Classification
    'genre': 'multiselect',
    'language_description_type': 'multiselect',
    'access_level_restrictions': 'text',
    // Accession
    'accession_number': 'text',
    'type_of_accession': 'select',
    'acquisition_notes': 'text',
    // Collector
    'collector_name': 'text',
    'collector_info': 'text',
    'collecting_notes': 'text',
    // Deposit
    'depositor_name': 'text',
    'depositor_contact_information': 'text',
    'project_grant': 'text',
    // Condition
    'availability_status': 'select',
    'availability_status_notes': 'text',
    'condition': 'select',
    'condition_notes': 'text',
    // Format
    'original_format_medium': 'select',
    'location_of_original': 'text',
    'other_institutional_number': 'text',
    // Conservation
    'conservation_recommendation': 'text',
    'conservation_treatments_performed': 'text',
    'equipment_used': 'text',
    'software_used': 'text',
    'ipm_issues': 'text',
    // Geographic
    'municipality_or_township': 'text',
    'county_or_parish': 'text',
    'state_or_province': 'text',
    'country_or_territory': 'text',
    'global_region': 'text',
    'recording_context': 'text',
    'public_event': 'text',
    'recorded_on': 'text',
    'latitude': 'decimal',
    'longitude': 'decimal',
    // Publisher
    'publisher': 'text',
    'publisher_address': 'text',
    // Cataloging
    'isbn': 'text',
    'loc_catalog_number': 'text',
    'collectors_number': 'text',
    'lender_loan_number': 'text',
    'temporary_accession_number': 'text',
    'other_information': 'text',
  };
  
  // Create cells from parsed data
  for (const fieldName in parsedCells) {
    cells[fieldName] = {
      text: parsedCells[fieldName].text,
      value: parsedCells[fieldName].value,
      type: fieldTypeMap[fieldName] || 'text',  // Use correct cell type
      isEdited: true,
      originalValue: '',
      validationState: 'validating',
      hasConflict: false,
      fieldName: fieldName,
    };
  }
  
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
 * Convert an Item API object to a SpreadsheetRow
 * This must match the logic in ItemBatchEditor.tsx
 */
const itemToSpreadsheetRow = (item: Item): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  // Map ALL field names to their cell types (matching ITEM_COLUMNS in ItemBatchEditor)
  const fieldTypeMap: Record<string, CellType> = {
    // Core
    'catalog_number': 'text',
    'item_access_level': 'select',
  'primary_title': 'title_with_language',
  'secondary_title': 'title_with_language',
  'description_scope_and_content': 'text',
    'resource_type': 'select',
    'call_number': 'text',
    'associated_ephemera': 'text',
    // Relationships
    'language': 'multiselect',
    'collaborators': 'collaborator_roles',
    // Dates
    'creation_date': 'text',
    'accession_date': 'text',
    'collection_date': 'text',
    'deposit_date': 'text',
    // Content Classification
    'genre': 'multiselect',
    'language_description_type': 'multiselect',
    'access_level_restrictions': 'text',
    // Accession
    'accession_number': 'text',
    'type_of_accession': 'select',
    'acquisition_notes': 'text',
    // Collector
    'collector_name': 'text',
    'collector_info': 'text',
    'collecting_notes': 'text',
    // Deposit
    'depositor_name': 'text',
    'depositor_contact_information': 'text',
    'project_grant': 'text',
    // Condition
    'availability_status': 'select',
    'availability_status_notes': 'text',
    'condition': 'select',
    'condition_notes': 'text',
    // Format
    'original_format_medium': 'select',
    'location_of_original': 'text',
    'other_institutional_number': 'text',
    // Conservation
    'conservation_recommendation': 'text',
    'conservation_treatments_performed': 'text',
    'equipment_used': 'text',
    'software_used': 'text',
    'ipm_issues': 'text',
    // Geographic
    'municipality_or_township': 'text',
    'county_or_parish': 'text',
    'state_or_province': 'text',
    'country_or_territory': 'text',
    'global_region': 'text',
    'recording_context': 'text',
    'public_event': 'text',
    'recorded_on': 'text',
    'latitude': 'decimal',
    'longitude': 'decimal',
    // Publication
    'publisher': 'text',
    'publisher_address': 'text',
    'isbn': 'text',
    'loc_catalog_number': 'text',
    'total_number_of_pages_and_physical_description': 'text',
    // External
    'temporary_accession_number': 'text',
    'lender_loan_number': 'text',
    'other_information': 'text',
  };
  
  Object.keys(fieldTypeMap).forEach(fieldName => {
    const value = (item as any)[fieldName];
    let displayValue = value?.toString() || '';
    
    // Handle boolean fields
    if (fieldTypeMap[fieldName] === 'boolean') {
      if (value === null || value === undefined) {
        displayValue = 'Not specified';
      } else {
        displayValue = value ? 'Yes' : 'No';
      }
    }
    
    // Handle multiselect languoid fields (M2M)
    if (fieldName === 'language' && Array.isArray(value)) {
      displayValue = value.map((lang: any) => lang.name).join(', ');
    }
    
    // Handle MultiSelectFields (genre, language_description_type)
    if ((fieldName === 'genre' || fieldName === 'language_description_type') && Array.isArray(value)) {
      displayValue = value.join(', ');
    }
    
    // Handle collaborators field
    if (fieldName === 'collaborators' && Array.isArray(value)) {
      displayValue = value.map((collab: any) => collab.name).join(', ');
    }
    
    cells[fieldName] = {
      text: displayValue,
      value: value ?? (Array.isArray(value) ? [] : ''),
      type: fieldTypeMap[fieldName],
      isEdited: false,
      originalValue: value ?? (Array.isArray(value) ? [] : ''),
      validationState: 'valid',
      hasConflict: false,
      fieldName: fieldName,
    };
  });
  
  return {
    id: item.id,
    cells,
    hasChanges: false,
    hasErrors: false,
    isSelected: false,
    isDraft: false,
  };
};

