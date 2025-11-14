/**
 * Collaborator Import Value Parsers
 * 
 * Type-aware parsers for transforming raw spreadsheet string values into
 * the correct data types for the Collaborator batch editor.
 */

import { Languoid } from './api';

/**
 * Cache lookup interface for Collaborators
 */
export interface CollaboratorCacheLookup {
  getByCollaboratorId: (id: number) => Promise<any | null>;
  getByName: (firstName: string, lastName: string, suffix: string) => Promise<any | null>;
  
  // For languoid lookups
  getLanguoidByGlottocode: (glottocode: string) => Promise<Languoid | null>;
  getLanguoidByName: (name: string) => Promise<Languoid | null>;
}

/**
 * Parse boolean value from various string representations
 * Handles: "yes", "no", "true", "false", "1", "0", "not specified", etc.
 */
export const parseCollaboratorBoolean = (value: string): { value: boolean | null; text: string } => {
  const normalized = value.trim().toLowerCase();
  
  if (normalized === 'yes' || normalized === 'true' || normalized === '1' || normalized === 'y') {
    return { value: true, text: 'Yes' };
  }
  
  if (normalized === 'no' || normalized === 'false' || normalized === '0' || normalized === 'n') {
    return { value: false, text: 'No' };
  }
  
  // Anything else (including "not specified", "", etc.) → null
  return { value: null, text: 'Not specified' };
};

/**
 * Parse comma-separated list for other_names field
 */
export const parseOtherNames = (value: string): { value: string[]; text: string } => {
  if (!value || value.trim() === '') {
    return { value: [], text: '' };
  }
  
  const names = value
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0);
  
  return {
    value: names,
    text: names.join(', '),
  };
};

/**
 * Parse comma-separated languoid names/glottocodes for M2M language fields
 * Format: "Cherokee, Navajo, swah1253" → [{id, name, glottocode}, ...]
 */
export const parseCommaSeparatedLanguoids = async (
  value: string,
  cache: CollaboratorCacheLookup
): Promise<{ value: Array<{id: number; name: string; glottocode: string}>; text: string }> => {
  if (!value || value.trim() === '') {
    return { value: [], text: '' };
  }
  
  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  const languoids: Array<{id: number; name: string; glottocode: string}> = [];
  const displayNames: string[] = [];
  
  for (const item of items) {
    let languoid: Languoid | null = null;
    
    // Try glottocode lookup first (8 characters, alphanumeric)
    if (/^[a-z0-9]{8}$/.test(item)) {
      languoid = await cache.getLanguoidByGlottocode(item);
    }
    
    // If not found, try name lookup
    if (!languoid) {
      languoid = await cache.getLanguoidByName(item);
    }
    
    if (languoid) {
      languoids.push({
        id: languoid.id,
        name: languoid.name,
        glottocode: languoid.glottocode,
      });
      displayNames.push(languoid.glottocode ? `${languoid.name} (${languoid.glottocode})` : languoid.name);
    } else {
      // Languoid not found - still record the text for error display
      displayNames.push(`${item} (not found)`);
    }
  }
  
  return {
    value: languoids,
    text: displayNames.join(', '),
  };
};

/**
 * Compare two cell values for equality (handles arrays, objects, primitives)
 * Used to determine if a cell has changed during import
 */
export const areCellValuesEqual = (a: any, b: any): boolean => {
  // Handle null/undefined/empty string equivalence
  if (a === null && b === null) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null && b === '') return true;
  if (a === '' && b === null) return true;
  if (a === undefined && b === '') return true;
  if (a === '' && b === undefined) return true;
  if (a === null && b === undefined) return true;
  if (a === undefined && b === null) return true;
  
  // Handle booleans explicitly (before string conversion)
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    // One is boolean, one is not - they're different
    return false;
  }
  
  // Handle arrays (order-insensitive comparison for M2M fields)
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    
    // For M2M language fields: compare by ID
    if (a.length > 0 && typeof a[0] === 'object' && 'id' in a[0]) {
      const aIds = a.map((item: any) => item.id).sort();
      const bIds = b.map((item: any) => item.id).sort();
      return JSON.stringify(aIds) === JSON.stringify(bIds);
    }
    
    // For string arrays (other_names): compare sorted
    const aSorted = [...a].sort();
    const bSorted = [...b].sort();
    return JSON.stringify(aSorted) === JSON.stringify(bSorted);
  }
  
  // Handle objects (should not occur, but handle gracefully)
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  
  // Handle primitives (strings, numbers)
  // Trim whitespace and convert to lowercase for case-insensitive comparison
  const aStr = String(a).trim().toLowerCase();
  const bStr = String(b).trim().toLowerCase();
  return aStr === bStr;
};

