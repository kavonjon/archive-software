/**
 * useImportCollaboratorSpreadsheet Hook
 * 
 * Orchestrates the entire import process for Collaborator batch editor:
 * 1. File validation
 * 2. Parsing
 * 3. Value transformation
 * 4. Duplicate detection (collaborator_id or name matching)
 * 5. Redux updates
 * 6. Validation triggering
 * 7. User feedback
 */

import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { useCollaboratorCache } from '../contexts/CollaboratorCacheContext';
import { useLanguoidCache } from '../contexts/LanguoidCacheContext';
import { useFieldValidation } from '../hooks/useFieldValidation';
import { validateCollaboratorField } from '../services/validationAPI';
import {
  importSpreadsheetChanges,
  selectRow,
  updateCell,
} from '../store/batchSpreadsheetSlice';
import { validateFile, parseExcelFile, parseCSVFile } from '../services/fileParser';
import { transformCollaboratorImportData, ImportResult } from '../services/collaboratorImportTransformer';
import { hasValidCollaboratorColumns } from '../services/collaboratorImportColumnMapper';
import { SpreadsheetRow, SpreadsheetCell } from '../types/spreadsheet';

export interface ImportProgress {
  stage: 'validating' | 'parsing' | 'processing' | 'updating' | 'validating_cells' | 'complete';
  message: string;
  percentage?: number;
}

export interface UseImportCollaboratorSpreadsheetReturn {
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

export const useImportCollaboratorSpreadsheet = (): UseImportCollaboratorSpreadsheetReturn => {
  const dispatch = useDispatch();
  const rows: SpreadsheetRow[] = useSelector((state: RootState) => state.batchSpreadsheet.rows);
  const { getByCollaboratorId, getByName, getCollaborators } = useCollaboratorCache();
  const { getByGlottocode, getByName: getLanguoidByName } = useLanguoidCache();
  const { validateField } = useFieldValidation({
    validateFn: validateCollaboratorField,
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
      
      const validation = await validateFile(file, hasValidCollaboratorColumns, 'Collaborator');
      
      if (!validation.valid) {
        throw new Error(validation.error || 'File validation failed');
      }
      
      // Check for warnings (large file)
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('[CollaboratorImport] File warnings:', validation.warnings);
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
      
      console.log(`[CollaboratorImport] Parsed ${parsedData.rows.length} rows from file`);
      
      // ========================================================================
      // STEP 3: Transform data with smart reconciliation
      // ========================================================================
      setImportProgress({
        stage: 'processing',
        message: 'Matching collaborators and resolving references...',
        percentage: 50,
      });
      
      const collaboratorCache = {
        getByCollaboratorId,
        getByName,
        getLanguoidByGlottocode: getByGlottocode,
        getLanguoidByName,
      };
      
      const result = await transformCollaboratorImportData(
        parsedData,
        rows,
        collaboratorCache
      );
      
      console.log(`[CollaboratorImport] Transformation result:`, {
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
        description: `Import ${result.newRows.length + result.modifiedRows.length} collaborators`,
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
          const { rowId, fieldName, value } = result.validationNeeded[i];
          
          // Update progress every 50 cells
          if (i % 50 === 0) {
            setImportProgress({
              stage: 'validating_cells',
              message: `Validating cells... (${i + 1}/${result.validationNeeded.length})`,
              percentage: 80 + Math.floor((i / result.validationNeeded.length) * 15),
            });
          }
          
          // Validate field
          await validateField(rowId, fieldName, value);
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
      
      console.log(`[CollaboratorImport] Import complete`);
      
      return result;
      
    } catch (err: any) {
      console.error('[CollaboratorImport] Import failed:', err);
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
  }, [dispatch, rows, getByCollaboratorId, getByName, getByGlottocode, getLanguoidByName]);
  
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

