/**
 * Stage 1 Phase 2: Validation API Service
 * 
 * Service for validating individual field values against backend
 */

import { apiRequest } from './api';

export interface ValidationRequest {
  field_name: string;
  value: any;
  row_id: string | number;
  original_value?: any;  // Optional - value when loaded from DB
}

export interface ValidationResponse {
  valid: boolean;
  error?: string;
}

/**
 * Validate a single field value for a specific model
 */
export const validateField = async (
  modelEndpoint: string,
  fieldName: string,
  value: any,
  rowId: string | number,
  originalValue?: any
): Promise<ValidationResponse> => {
  try {
    const response = await apiRequest<ValidationResponse>(`${modelEndpoint}/validate-field/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        field_name: fieldName,
        value: value,
        row_id: rowId,
        original_value: originalValue,
      }),
    });
    
    return response;
  } catch (error: any) {
    // If the backend returned a validation error response
    if (error.response?.data) {
      return error.response.data as ValidationResponse;
    }
    
    // Generic error
    return {
      valid: false,
      error: error.message || 'Validation request failed',
    };
  }
};

/**
 * Validate a languoid field
 */
export const validateLanguoidField = (
  fieldName: string,
  value: any,
  rowId: string | number,
  originalValue?: any
): Promise<ValidationResponse> => {
  return validateField('/languoids', fieldName, value, rowId, originalValue);
};

/**
 * Validate a collaborator field
 */
export const validateCollaboratorField = (
  fieldName: string,
  value: any,
  rowId: string | number
): Promise<ValidationResponse> => {
  return validateField('/collaborators', fieldName, value, rowId);
};

/**
 * Validate an item field
 */
export const validateItemField = (
  fieldName: string,
  value: any,
  rowId: string | number
): Promise<ValidationResponse> => {
  return validateField('/items', fieldName, value, rowId);
};

