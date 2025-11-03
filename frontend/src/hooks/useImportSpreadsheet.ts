/**
 * useImportSpreadsheet Hook
 * 
 * Orchestrates the entire import process:
 * 1. File validation
 * 2. Parsing
 * 3. Value transformation
 * 4. Duplicate detection
 * 5. Redux updates
 * 6. Validation triggering
 * 7. User feedback
 */

import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { useLanguoidCache } from '../contexts/LanguoidCacheContext';
import { useFieldValidation } from '../hooks/useFieldValidation';
import { validateLanguoidField } from '../services/validationAPI';
import {
  importSpreadsheetChanges,
  updateCell,
  selectRow,
} from '../store/batchSpreadsheetSlice';
import { validateFile, parseExcelFile, parseCSVFile } from '../services/fileParser';
import { transformImportData, ImportResult } from '../services/importTransformer';
import { SpreadsheetRow } from '../types/spreadsheet';

export interface ImportProgress {
  stage: 'validating' | 'parsing' | 'processing' | 'updating' | 'validating_cells' | 'complete';
  message: string;
  percentage?: number;
}

export interface UseImportSpreadsheetReturn {
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

export const useImportSpreadsheet = (): UseImportSpreadsheetReturn => {
  const dispatch = useDispatch();
  const rows: SpreadsheetRow[] = useSelector((state: RootState) => state.batchSpreadsheet.rows);
  const { getByGlottocode, getByName } = useLanguoidCache();
  const { validateField } = useFieldValidation({
    validateFn: validateLanguoidField,
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
      
      const validation = await validateFile(file);
      
      if (!validation.valid) {
        throw new Error(validation.error || 'File validation failed');
      }
      
      // Check for warnings (large file)
      if (validation.warnings && validation.warnings.length > 0) {
        // TODO: Show warning dialog in Phase 8
        // For now, just log it
        console.warn('[Import] File warnings:', validation.warnings);
      }
      
      // ========================================================================
      // STEP 2: Parse file
      // ========================================================================
      setImportProgress({
        stage: 'parsing',
        message: `Parsing ${validation.fileType} file...`,
        percentage: 20,
      });
      
      const parsedData = validation.fileType === 'excel'
        ? await parseExcelFile(file)
        : await parseCSVFile(file);
      
      // ========================================================================
      // STEP 3: Transform data (FK lookups, duplicate detection)
      // ========================================================================
      setImportProgress({
        stage: 'processing',
        message: `Processing ${parsedData.rowCount} rows...`,
        percentage: 40,
      });
      
      const languoidCache = { getByGlottocode, getByName };
      const importResult = await transformImportData(parsedData, rows, languoidCache);
      
      // ========================================================================
      // STEP 4: Update Redux (single undoable action for entire import)
      // ========================================================================
      setImportProgress({
        stage: 'updating',
        message: 'Updating spreadsheet...',
        percentage: 60,
      });
      
      // Collect all cell changes for modified rows
      const cellChanges: Array<{ rowId: string | number; fieldName: string; cell: { value: any; text: string; isEdited: boolean } }> = [];
      
      importResult.modifiedRows.forEach(({ rowId, changes }) => {
        Object.entries(changes).forEach(([fieldName, { value, text }]) => {
          cellChanges.push({
            rowId,
            fieldName,
            cell: {
              value,
              text,
              isEdited: true,
            },
          });
        });
      });
      
      // Calculate import description
      const totalAffected = importResult.newRows.length + importResult.modifiedRows.length;
      const description = `Import ${totalAffected} row${totalAffected !== 1 ? 's' : ''}`;
      
      // Dispatch single import action (creates one undo entry)
      dispatch(importSpreadsheetChanges({
        newRows: importResult.newRows,
        cellChanges,
        description,
      }));
      
      // Auto-check all affected rows (new, modified, and unchanged)
      [...importResult.newRows, ...importResult.modifiedRows, ...importResult.unchangedRows].forEach(item => {
        const rowId = 'rowId' in item ? item.rowId : item.id;
        dispatch(selectRow(rowId));
      });
      
      // ========================================================================
      // STEP 5: Apply name conflicts (orange cells)
      // ========================================================================
      if (importResult.nameConflicts.length > 0) {
        importResult.nameConflicts.forEach(({ rowId, name, existingGlottocode }) => {
          dispatch(updateCell({
            rowId,
            fieldName: 'name',
            cell: {
              validationState: 'invalid', // Orange cells use 'invalid' state with warning styling
              validationError: `A languoid named "${name}" (${existingGlottocode}) already exists. Please verify this is not a duplicate.`,
            },
          }));
        });
      }
      
      // ========================================================================
      // STEP 6: Trigger validation for all affected cells
      // ========================================================================
      setImportProgress({
        stage: 'validating_cells',
        message: `Validating ${importResult.validationNeeded.length} cells...`,
        percentage: 80,
      });
      
      // Show spinner cursor during validation
      document.body.style.cursor = 'wait';
      
      try {
        // Validate all cells (no debounce, immediate)
        for (let i = 0; i < importResult.validationNeeded.length; i++) {
          const { rowId, fieldName, value } = importResult.validationNeeded[i];
          
          // Update progress periodically
          if (i % 10 === 0) {
            const validationPercentage = 80 + (i / importResult.validationNeeded.length) * 15;
            setImportProgress({
              stage: 'validating_cells',
              message: `Validating cells (${i + 1}/${importResult.validationNeeded.length})...`,
              percentage: Math.round(validationPercentage),
            });
          }
          
          // Get originalValue for validation context
          const row = rows.find(r => r.id === rowId) || importResult.newRows.find(r => r.id === rowId);
          const originalValue = row?.cells[fieldName]?.originalValue;
          
          await validateField(rowId, fieldName, value, originalValue);
        }
      } finally {
        // Remove spinner cursor
        document.body.style.cursor = 'default';
      }
      
      // ========================================================================
      // STEP 7: Complete
      // ========================================================================
      setImportProgress({
        stage: 'complete',
        message: 'Import complete!',
        percentage: 100,
      });
      
      // Clear progress after a short delay
      setTimeout(() => {
        setImportProgress(null);
      }, 1000);
      
      return importResult;
      
    } catch (error: any) {
      console.error('[Import] Error:', error);
      setImportError(error.message || 'Failed to import file');
      setImportProgress(null);
      return null;
    } finally {
      setIsImporting(false);
    }
  }, [dispatch, rows, getByGlottocode, getByName, validateField]);
  
  /**
   * Clear the import error
   */
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

