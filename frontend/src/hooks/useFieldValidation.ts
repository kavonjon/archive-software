/**
 * Stage 1 Phase 2: Field Validation Hook
 * 
 * Custom hook for debounced field validation in batch editing
 */

import { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { ValidationResponse } from '../services/validationAPI';
import { updateCell, addValidatingCell, removeValidatingCell } from '../store/batchSpreadsheetSlice';

interface UseFieldValidationOptions {
  /**
   * Validation function to call
   */
  validateFn: (fieldName: string, value: any, rowId: string | number, originalValue?: any) => Promise<ValidationResponse>;
  
  /**
   * Debounce delay in milliseconds
   * @default 500
   */
  debounceMs?: number;
}

/**
 * Hook for validating fields with debouncing
 * 
 * @example
 * const validateField = useFieldValidation({
 *   validateFn: validateLanguoidField,
 *   debounceMs: 500
 * });
 * 
 * // Later in component
 * validateField(rowId, fieldName, newValue, originalValue);
 */
export const useFieldValidation = ({ validateFn, debounceMs = 500 }: UseFieldValidationOptions) => {
  const dispatch = useDispatch();
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const validateField = useCallback(
    (rowId: string | number, fieldName: string, value: any, originalValue?: any) => {
      const key = `${rowId}-${fieldName}`;
      
      // Clear existing timeout for this field
      const existingTimeout = timeoutRefs.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Set validating state immediately
      dispatch(addValidatingCell({ rowId, fieldName }));
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          validationState: 'validating',
          validationError: undefined,
        },
      }));
      
      // Create new debounced validation
      const timeout = setTimeout(async () => {
        try {
          const result = await validateFn(fieldName, value, rowId, originalValue);
          
          // Update cell with validation result
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: result.valid ? 'valid' : 'invalid',
              validationError: result.error,
            },
          }));
        } catch (error) {
          // Handle validation error
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: 'invalid',
              validationError: 'Validation request failed',
            },
          }));
        } finally {
          // Remove from validating set
          dispatch(removeValidatingCell({ rowId, fieldName }));
          timeoutRefs.current.delete(key);
        }
      }, debounceMs);
      
      timeoutRefs.current.set(key, timeout);
    },
    [validateFn, debounceMs, dispatch]
  );
  
  // Cleanup on unmount
  const cleanup = useCallback(() => {
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current.clear();
  }, []);
  
  return { validateField, cleanup };
};

