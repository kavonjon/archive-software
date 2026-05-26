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
  formatTitleWithLanguageDisplay,
  normalizeTitleWithLanguageValue,
} from './itemImportValueParsers';
import { v4 as uuidv4 } from 'uuid';
import { normalizeCatalogNumber } from './catalogUniqueness';

export interface FileCatalogDuplicate {
  catalog_number: string;
  supersededFileRowNumbers: number[];
  keptFileRowNumber: number;
  gridRowId: string | number;
}

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

  /** Duplicate catalog numbers within the import file (last file row wins) */
  fileCatalogDuplicates: FileCatalogDuplicate[];
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
  const catalogFileRows = new Map<string, { fileRows: number[]; gridRowId: string | number }>();
  
  // Analyze columns
  const columnInfo = analyzeItemColumns(parsedData.headers);
  
  // Process each row
  for (let fileRowIndex = 0; fileRowIndex < parsedData.rows.length; fileRowIndex++) {
    const rawRow = parsedData.rows[fileRowIndex];
    const fileRowNumber = fileRowIndex + 2;

    // Step 1: Parse all cell values
    const parsedCells = await parseCellValues(rawRow, columnInfo.valid, itemCache, validationNeeded);
    
    // Step 2: Extract catalog_number for duplicate detection
    const catalog_number = parsedCells['catalog_number']?.value;
    
    if (!catalog_number) {
      // Skip rows without catalog_number (required field)
      console.warn('[ItemImport] Skipping row without catalog_number');
      continue;
    }

    const catalogKey = normalizeCatalogNumber(catalog_number);
    
    let existingRow: SpreadsheetRow | null = findRowByCatalog(catalogKey, currentRows, newRows);
    let dbItem: Item | null = null;

    if (!existingRow) {
      dbItem = await itemCache.getByCatalogNumber(catalogKey);
      if (dbItem) {
        existingRow = newRows.find((row) => row.id === dbItem!.id) ?? null;
      }
    }

    const noteCatalogRow = (gridRowId: string | number) => {
      noteCatalogFileRow(catalogFileRows, catalogKey, fileRowNumber, gridRowId);
    };

    const assignPendingValidation = (targetRowId: string | number) => {
      validationNeeded.forEach((entry) => {
        if (entry.rowId === 'pending') {
          entry.rowId = targetRowId;
        }
      });
    };

    const queueValidationForChanges = (
      rowId: string | number,
      changes: Record<string, { value: any; text: string }>
    ) => {
      Object.keys(changes).forEach((fieldName) => {
        const hasParserError = validationNeeded.some(
          (entry) => entry.rowId === rowId && entry.fieldName === fieldName && entry.error
        );

        if (!hasParserError) {
          validationNeeded.push({
            rowId,
            fieldName,
            value: changes[fieldName].value,
          });
        }
      });
    };

    const queueFullValidation = (rowId: string | number) => {
      Object.keys(parsedCells).forEach((fieldName) => {
        const hasParserError = validationNeeded.some(
          (entry) => entry.rowId === rowId && entry.fieldName === fieldName && entry.error
        );

        if (!hasParserError) {
          validationNeeded.push({
            rowId,
            fieldName,
            value: parsedCells[fieldName].value,
          });
        }
      });
    };

    const mergeIntoExistingRow = (targetRow: SpreadsheetRow, inCurrentGrid: boolean) => {
      const changes = getChangedCells(targetRow, parsedCells);

      if (Object.keys(changes).length > 0) {
        if (inCurrentGrid) {
          modifiedRows.push({
            rowId: targetRow.id,
            changes,
          });
        } else {
          const rowIndex = newRows.findIndex((row) => row.id === targetRow.id);
          if (rowIndex === -1) {
            console.warn('[ItemImport] Expected import row missing during merge:', targetRow.id);
            return;
          }

          const updatedRow = applyChangesToRow(newRows[rowIndex], changes);
          updatedRow.isSelected = true;
          newRows[rowIndex] = updatedRow;
        }

        assignPendingValidation(targetRow.id);
        queueValidationForChanges(targetRow.id, changes);
      } else {
        unchangedRows.push({ rowId: targetRow.id });
      }

      noteCatalogRow(targetRow.id);
    };

    if (existingRow) {
      const inCurrentGrid = currentRows.some((row) => row.id === existingRow!.id);
      mergeIntoExistingRow(existingRow, inCurrentGrid);
      continue;
    }

    if (dbItem) {
      const rowFromDb = itemToSpreadsheetRow(dbItem);
      const changes = getChangedCells(rowFromDb, parsedCells);

      if (Object.keys(changes).length > 0) {
        const updatedRow = applyChangesToRow(rowFromDb, changes);
        updatedRow.isSelected = true;
        newRows.push(updatedRow);
        assignPendingValidation(updatedRow.id);
        queueValidationForChanges(updatedRow.id, changes);
        noteCatalogRow(updatedRow.id);
      } else {
        rowFromDb.isSelected = true;
        newRows.push(rowFromDb);
        noteCatalogRow(rowFromDb.id);
      }

      continue;
    }

    const draftRow = await createDraftRowFromParsedCells(parsedCells);
    draftRow.isSelected = true;
    newRows.push(draftRow);
    assignPendingValidation(draftRow.id);
    queueFullValidation(draftRow.id);
    noteCatalogRow(draftRow.id);
  }

  const fileCatalogDuplicates = buildFileCatalogDuplicateReport(catalogFileRows);
  
  return {
    newRows,
    modifiedRows,
    unchangedRows,
    nameConflicts: [],  // Not used for Items
    validationNeeded,
    columnInfo,
    fileCatalogDuplicates,
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
        errors = choiceResult.errors;
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
const findRowByCatalog = (
  catalogKey: string,
  currentRows: SpreadsheetRow[],
  newRows: SpreadsheetRow[]
): SpreadsheetRow | null => {
  return (
    currentRows.find((row) =>
      normalizeCatalogNumber(row.cells.catalog_number?.value) === catalogKey
    ) ??
    newRows.find((row) =>
      normalizeCatalogNumber(row.cells.catalog_number?.value) === catalogKey
    ) ??
    null
  );
};

const noteCatalogFileRow = (
  catalogFileRows: Map<string, { fileRows: number[]; gridRowId: string | number }>,
  catalogKey: string,
  fileRowNumber: number,
  gridRowId: string | number
) => {
  const existing = catalogFileRows.get(catalogKey);
  if (existing) {
    existing.fileRows.push(fileRowNumber);
    existing.gridRowId = gridRowId;
    return;
  }

  catalogFileRows.set(catalogKey, {
    fileRows: [fileRowNumber],
    gridRowId,
  });
};

const buildFileCatalogDuplicateReport = (
  catalogFileRows: Map<string, { fileRows: number[]; gridRowId: string | number }>
): FileCatalogDuplicate[] => {
  const duplicates: FileCatalogDuplicate[] = [];

  catalogFileRows.forEach(({ fileRows, gridRowId }, catalog_number) => {
    if (fileRows.length <= 1) {
      return;
    }

    duplicates.push({
      catalog_number,
      supersededFileRowNumbers: fileRows.slice(0, -1),
      keptFileRowNumber: fileRows[fileRows.length - 1],
      gridRowId,
    });
  });

  return duplicates;
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
    let value = (item as any)[fieldName];
    let displayValue = value?.toString() || '';
    
    // Handle title fields — must match ItemBatchEditor.itemToRow (not value.toString())
    if (fieldName === 'primary_title' || fieldName === 'secondary_title') {
      value = normalizeTitleWithLanguageValue(value);
      displayValue = formatTitleWithLanguageDisplay(value);
    } else if (fieldTypeMap[fieldName] === 'boolean') {
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

    const emptyArrayDefault =
      fieldTypeMap[fieldName] === 'multiselect' || fieldTypeMap[fieldName] === 'collaborator_roles';
    const cellValue =
      fieldName === 'primary_title' || fieldName === 'secondary_title'
        ? value
        : value ?? (emptyArrayDefault ? [] : '');
    
    cells[fieldName] = {
      text: displayValue,
      value: cellValue,
      type: fieldTypeMap[fieldName],
      isEdited: false,
      originalValue: cellValue,
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

