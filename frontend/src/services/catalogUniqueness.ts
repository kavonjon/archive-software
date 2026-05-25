import { SpreadsheetRow } from '../types/spreadsheet';
import { Item } from './api';

export const CATALOG_REQUIRED_ERROR = 'Catalog Number is required';
export const CATALOG_DUPLICATE_IN_GRID_ERROR =
  'This catalog number is already used in another row';
export const CATALOG_DUPLICATE_IN_DB_ERROR =
  'This catalog number already exists in the database';

export function normalizeCatalogNumber(value: unknown): string {
  return String(value ?? '').trim();
}

export function catalogsMatch(a: unknown, b: unknown): boolean {
  return normalizeCatalogNumber(a) === normalizeCatalogNumber(b);
}

export function isDuplicateCatalogInSpreadsheet(
  rows: SpreadsheetRow[],
  catalogNumber: string,
  excludeRowId: string | number
): boolean {
  const normalized = normalizeCatalogNumber(catalogNumber);
  if (!normalized) {
    return false;
  }

  return rows.some((row) => {
    if (row.id === excludeRowId) {
      return false;
    }
    return catalogsMatch(row.cells.catalog_number?.value, normalized);
  });
}

export function isDuplicateCatalogInBackend(
  items: Item[],
  catalogNumber: string,
  excludeRowId: string | number
): boolean {
  const normalized = normalizeCatalogNumber(catalogNumber);
  if (!normalized) {
    return false;
  }

  return items.some((item) => {
    if (item.id === excludeRowId) {
      return false;
    }
    return item.catalog_number === normalized;
  });
}

export type CatalogClientValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validateCatalogNumberClientSide(params: {
  value: unknown;
  rowId: string | number;
  rows: SpreadsheetRow[];
  originalCatalogFromCell?: unknown;
}): CatalogClientValidationResult {
  const valueStr = normalizeCatalogNumber(params.value);

  if (!valueStr) {
    return { valid: false, error: CATALOG_REQUIRED_ERROR };
  }

  if (
    params.originalCatalogFromCell !== undefined &&
    valueStr === normalizeCatalogNumber(params.originalCatalogFromCell)
  ) {
    return { valid: true };
  }

  if (isDuplicateCatalogInSpreadsheet(params.rows, valueStr, params.rowId)) {
    return { valid: false, error: CATALOG_DUPLICATE_IN_GRID_ERROR };
  }

  return { valid: true };
}

export function getGridCatalogDuplicateInvalidations(
  rows: SpreadsheetRow[]
): Array<{ rowId: string | number; fieldName: 'catalog_number' }> {
  const firstIndexByCatalog = new Map<string, number>();
  const invalid: Array<{ rowId: string | number; fieldName: 'catalog_number' }> = [];

  rows.forEach((row, index) => {
    const catalog = normalizeCatalogNumber(row.cells.catalog_number?.value);
    if (!catalog) {
      return;
    }

    const firstIndex = firstIndexByCatalog.get(catalog);
    if (firstIndex === undefined) {
      firstIndexByCatalog.set(catalog, index);
      return;
    }

    invalid.push({ rowId: row.id, fieldName: 'catalog_number' });
  });

  return invalid;
}

export function applyChangesToRowsSnapshot(
  rows: SpreadsheetRow[],
  changes: Array<{
    rowId: string | number;
    fieldName: string;
    newValue: unknown;
    newText?: string;
  }>
): SpreadsheetRow[] {
  return rows.map((row) => {
    const rowChanges = changes.filter((change) => change.rowId === row.id);
    if (rowChanges.length === 0) {
      return row;
    }

    const cells = { ...row.cells };
    rowChanges.forEach(({ fieldName, newValue, newText }) => {
      const existingCell = cells[fieldName];
      if (!existingCell) {
        return;
      }

      cells[fieldName] = {
        ...existingCell,
        value: newValue,
        text:
          newText ??
          (typeof newValue === 'string' ? newValue : String(newValue ?? '')),
      };
    });

    return { ...row, cells };
  });
}
