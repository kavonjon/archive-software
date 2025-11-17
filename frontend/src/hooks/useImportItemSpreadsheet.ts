/**
 * useImportItemSpreadsheet Hook
 * 
 * Orchestrates the entire import process for Item batch editor:
 * 1. File validation
 * 2. Parsing
 * 3. Value transformation
 * 4. Duplicate detection (catalog_number matching)
 * 5. Redux updates
 * 6. Validation triggering
 * 7. User feedback
 */

import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { useItemCache } from '../contexts/ItemCacheContext';
import { useLanguoidCache } from '../contexts/LanguoidCacheContext';
import { useCollaboratorCache } from '../contexts/CollaboratorCacheContext';
import { useFieldValidation } from '../hooks/useFieldValidation';
import { validateItemField } from '../services/validationAPI';
import {
  importSpreadsheetChanges,
  selectRow,
  updateCell,
} from '../store/batchSpreadsheetSlice';
import { validateFile, parseExcelFile, parseCSVFile } from '../services/fileParser';
import { transformItemImportData, ImportResult } from '../services/itemImportTransformer';
import { hasValidItemColumns } from '../services/itemImportColumnMapper';
import { SpreadsheetRow, SpreadsheetCell } from '../types/spreadsheet';

export interface ImportProgress {
  stage: 'validating' | 'parsing' | 'processing' | 'updating' | 'validating_cells' | 'complete';
  message: string;
  percentage?: number;
}

export interface UseImportItemSpreadsheetReturn {
  /** Process a file and import into spreadsheet */
  processFile: (file: File) => Promise<ImportResult | null>;
  
  /** Current import state */
  isImporting: boolean;
  
  /** Current progress information */
  importProgress: ImportProgress | null;
  
  /** Error message if import failed */
  importError: string | null;
  
  /** Clear the import error */
  clearImportError: () => void;
}

export const useImportItemSpreadsheet = (): UseImportItemSpreadsheetReturn => {
  const dispatch = useDispatch();
  const rows: SpreadsheetRow[] = useSelector((state: RootState) => state.batchSpreadsheet.rows);
  const { getByCatalogNumber, getItems } = useItemCache();
  const { getByGlottocode, getByName: getLanguoidByName } = useLanguoidCache();
  const { getByFullName: getCollaboratorByFullName, getAllByFullNameWithoutNickname: getCollaboratorByNameWithoutNickname } = useCollaboratorCache();
  const { validateField } = useFieldValidation({
    validateFn: validateItemField,
    debounceMs: 0, // No debounce for import validation
  });
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  
  /**
   * Main import processing function
   */
  const processFile = useCallback(async (file: File): Promise<ImportResult | null> => {
    try {
      setIsImporting(true);
      setImportError(null);
      
      // ========================================================================
      // STEP 1: Validate file
      // ========================================================================
      setImportProgress({
        stage: 'validating',
        message: 'Validating file...',
        percentage: 10,
      });
      
      const validation = await validateFile(file, hasValidItemColumns, 'Item');
      
      if (!validation.valid) {
        throw new Error(validation.error || 'File validation failed');
      }
      
      // Check for warnings (large file)
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('[ItemImport] File warnings:', validation.warnings);
      }
      
      // ========================================================================
      // STEP 2: Parse file
      // ========================================================================
      setImportProgress({
        stage: 'parsing',
        message: `Parsing ${validation.fileType} file...`,
        percentage: 30,
      });
      
      let parsedData;
      if (validation.fileType === 'excel') {
        parsedData = await parseExcelFile(file);
      } else {
        parsedData = await parseCSVFile(file);
      }
      
      console.log(`[ItemImport] Parsed ${parsedData.rows.length} rows from file`);
      
      // ========================================================================
      // STEP 3: Transform data with smart reconciliation
      // ========================================================================
      setImportProgress({
        stage: 'processing',
        message: 'Matching items and resolving references...',
        percentage: 50,
      });
      
      const itemCache = {
        getByCatalogNumber,
        getLanguoidByGlottocode: getByGlottocode,
        getLanguoidByName,
        getCollaboratorByFullName,
        getCollaboratorByNameWithoutNickname,
      };
      
      const result = await transformItemImportData(
        parsedData,
        rows,
        itemCache
      );
      
      console.log(`[ItemImport] Transformation result:`, {
        newRows: result.newRows.length,
        modifiedRows: result.modifiedRows.length,
        unchangedRows: result.unchangedRows.length,
      });
      
      // ========================================================================
      // STEP 4: Dispatch single Redux action (entire import = 1 undo action)
      // ========================================================================
      setImportProgress({
        stage: 'updating',
        message: 'Updating spreadsheet...',
        percentage: 70,
      });
      
      // Convert modifiedRows to cellChanges format
      const cellChanges: Array<{ rowId: string | number; fieldName: string; cell: Partial<SpreadsheetCell> }> = [];
      result.modifiedRows.forEach(mod => {
        Object.keys(mod.changes).forEach(fieldName => {
          cellChanges.push({
            rowId: mod.rowId,
            fieldName,
            cell: {
              text: mod.changes[fieldName].text,
              value: mod.changes[fieldName].value,
              isEdited: true,
            },
          });
        });
      });
      
      dispatch(importSpreadsheetChanges({
        newRows: result.newRows,
        cellChanges,
        description: `Import ${result.newRows.length + result.modifiedRows.length} items`,
      }));
      
      // ========================================================================
      // STEP 5: Auto-select all affected rows
      // ========================================================================
      setImportProgress({
        stage: 'updating',
        message: 'Selecting affected rows...',
        percentage: 80,
      });
      
      // Select all new rows
      result.newRows.forEach(row => {
        dispatch(selectRow(row.id));
      });
      
      // Select all modified rows
      result.modifiedRows.forEach(mod => {
        dispatch(selectRow(mod.rowId));
      });
      
      // Select all unchanged rows (were in import, should be checked)
      result.unchangedRows.forEach(unchanged => {
        dispatch(selectRow(unchanged.rowId));
      });
      
      // ========================================================================
      // STEP 6: Trigger validation for all affected cells
      // ========================================================================
      setImportProgress({
        stage: 'validating_cells',
        message: `Validating ${result.validationNeeded.length} cells...`,
        percentage: 80,
      });
      
      // Show spinner cursor during validation
      document.body.style.cursor = 'wait';
      
      try {
        // Validate all cells (no debounce, immediate)
        for (let i = 0; i < result.validationNeeded.length; i++) {
          const { rowId, fieldName, value, error } = result.validationNeeded[i];
          
          // Update progress every 50 cells
          if (i % 50 === 0) {
            setImportProgress({
              stage: 'validating_cells',
              message: `Validating cells... (${i + 1}/${result.validationNeeded.length})`,
              percentage: 80 + Math.floor((i / result.validationNeeded.length) * 15),
            });
          }
          
          // Check if this is a new/draft row (ID starts with 'new-')
          const isNewRow = String(rowId).startsWith('new-');
          
          // If parser returned an error, mark cell as invalid immediately
          if (error) {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                validationState: 'invalid',
                validationError: error,
              },
            }));
          } else if (isNewRow) {
            // Skip backend validation for new rows (they don't exist in DB yet)
            // Just mark them as valid (client-side validation already happened during parsing)
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                validationState: 'valid',
              },
            }));
          } else {
            // Existing row - validate with backend
            // Skip backend validation for virtual/composite fields that don't exist in the model
            // or fields that use SerializerMethodField (read-only in the serializer)
            const skipValidationFields = ['primary_title', 'secondary_title', 'collaborators', 'language'];
            
            if (!skipValidationFields.includes(fieldName)) {
              // Validate field with backend
              await validateField(rowId, fieldName, value);
            }
            // If field is in skip list and no parser error, mark as valid
            else {
              dispatch(updateCell({
                rowId,
                fieldName,
                cell: {
                  validationState: 'valid',
                },
              }));
            }
          }
        }
      } finally {
        // Restore cursor
        document.body.style.cursor = '';
      }
      
      // ========================================================================
      // COMPLETE
      // ========================================================================
      setImportProgress({
        stage: 'complete',
        message: `Successfully imported ${result.newRows.length + result.modifiedRows.length} rows`,
        percentage: 100,
      });
      
      console.log(`[ItemImport] Import complete`);
      
      return result;
      
    } catch (err: any) {
      console.error('[ItemImport] Import failed:', err);
      const errorMessage = err.message || 'Import failed. Please check your file and try again.';
      setImportError(errorMessage);
      setImportProgress(null);
      return null;
    } finally {
      setIsImporting(false);
      
      // Clear progress after 3 seconds
      setTimeout(() => {
        setImportProgress(null);
      }, 3000);
    }
  }, [dispatch, rows, getByCatalogNumber, getByGlottocode, getLanguoidByName, validateField]);
  
  const clearImportError = useCallback(() => {
    setImportError(null);
  }, []);
  
  return {
    processFile,
    isImporting,
    importProgress,
    importError,
    clearImportError,
  };
};

