/**
 * Import Value Parsers
 * 
 * Transform raw string values from Excel/CSV into typed cell values
 * for the batch editor.
 */

import { Languoid } from './api';

/**
 * Interface for languoid cache operations
 * (Will be implemented by LanguoidCacheContext)
 */
export interface LanguoidCacheLookup {
  getByGlottocode: (glottocode: string) => Promise<Languoid | null>;
  getByName: (name: string) => Promise<Languoid | null>;
}

// ============================================================================
// Parser 1: Fuzzy Match for Select Fields (Level Glottolog)
// ============================================================================

/**
 * Parse Level (Glottolog) value with fuzzy matching
 * Handles variations like "lang" → "language", "fam" → "family"
 */
export const parseLevelGlottolog = (value: string): string | null => {
  if (!value || !value.trim()) return null;
  
  const normalized = value.toLowerCase().trim();
  
  // Valid choices
  const choices = ['family', 'language', 'dialect'];
  
  // 1. Exact match
  if (choices.includes(normalized)) {
    return normalized;
  }
  
  // 2. Partial match (starts with)
  const partialMatch = choices.find(choice => 
    choice.startsWith(normalized) || normalized.startsWith(choice)
  );
  if (partialMatch) {
    return partialMatch;
  }
  
  // 3. Fuzzy match (contains)
  const fuzzyMatch = choices.find(choice => 
    choice.includes(normalized) || normalized.includes(choice)
  );
  if (fuzzyMatch) {
    return fuzzyMatch;
  }
  
  // No match - return raw value (validation will catch it)
  return value.trim();
};

// ============================================================================
// Parser 2: Comma-Separated List for StringArray (Alternate Names)
// ============================================================================

/**
 * Parse comma-separated list into string array
 * Example: "English, Anglish, Englisch" → ["English", "Anglish", "Englisch"]
 */
export const parseAlternateNames = (value: string): string[] => {
  if (!value || !value.trim()) return [];
  
  return value
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0);
};

// ============================================================================
// Parser 3: Glottocode to ID for Relationship (Parent Languoid)
// ============================================================================

export interface GlottocodeToIdResult {
  /** Languoid ID (null if not found or empty) */
  id: number | null;
  
  /** Display text for cell (e.g., "English (eng1234)") */
  text: string;
  
  /** Whether the glottocode was found in cache */
  found: boolean;
}

/**
 * Lookup languoid by glottocode and return ID + display text
 * 
 * @param glottocode - Raw glottocode string from spreadsheet
 * @param cache - Languoid cache for lookup
 * @returns Object with id, text, and found status
 */
export const parseGlottocodeToId = async (
  glottocode: string,
  cache: LanguoidCacheLookup
): Promise<GlottocodeToIdResult> => {
  // Handle empty values
  if (!glottocode || !glottocode.trim()) {
    return { id: null, text: '', found: true }; // Empty is valid
  }
  
  const trimmed = glottocode.trim();
  
  // Lookup in cache
  const languoid = await cache.getByGlottocode(trimmed);
  
  if (languoid) {
    // Found! Return ID and formatted display text
    return {
      id: languoid.id,
      text: `${languoid.name} (${languoid.glottocode})`,
      found: true,
    };
  } else {
    // Not found - return glottocode as text (validation will mark red)
    return {
      id: null,
      text: trimmed,
      found: false,
    };
  }
};

// ============================================================================
// Parser 4: Comma-Separated Glottocodes for MultiSelect (M2M)
// ============================================================================

export interface CommaSeparatedGlottocodesResult {
  /** Array of languoid IDs */
  ids: number[];
  
  /** Display text for cell (e.g., "Indo-European, Sino-Tibetan") */
  text: string;
  
  /** Whether all glottocodes were found */
  allFound: boolean;
  
  /** Glottocodes that were not found */
  notFound: string[];
}

/**
 * Parse comma-separated glottocodes into array of IDs
 * Example: "indo1319, sino1245" → [123, 456]
 * 
 * NOTE: This is placeholder code for future M2M fields (not used for languoids)
 */
export const parseCommaSeparatedGlottocodes = async (
  value: string,
  cache: LanguoidCacheLookup
): Promise<CommaSeparatedGlottocodesResult> => {
  // Handle empty values
  if (!value || !value.trim()) {
    return { ids: [], text: '', allFound: true, notFound: [] };
  }
  
  // Split and trim
  const glottocodes = value
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0);
  
  const ids: number[] = [];
  const labels: string[] = [];
  const notFound: string[] = [];
  
  // Lookup each glottocode
  for (const glottocode of glottocodes) {
    const languoid = await cache.getByGlottocode(glottocode);
    
    if (languoid) {
      ids.push(languoid.id);
      labels.push(languoid.name);
    } else {
      notFound.push(glottocode);
    }
  }
  
  return {
    ids,
    text: labels.join(', '),
    allFound: notFound.length === 0,
    notFound,
  };
};

// ============================================================================
// Comparison Utilities (for Duplicate Detection)
// ============================================================================

/**
 * Check if two string arrays are equal (order-insensitive)
 * Example: ["a", "b"] === ["b", "a"] → true
 */
export const areStringArraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  
  // Convert to sets for order-insensitive comparison
  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  
  if (setA.size !== setB.size) return false;
  
  // Check if all elements in setA exist in setB
  return Array.from(setA).every(val => setB.has(val));
};

/**
 * Check if two cell values are equal (type-aware)
 * Handles special cases for stringarray (order-insensitive)
 */
export const areCellValuesEqual = (
  valueA: any,
  valueB: any,
  cellType: string
): boolean => {
  // Handle null/undefined
  if (valueA === null || valueA === undefined) {
    return valueB === null || valueB === undefined;
  }
  if (valueB === null || valueB === undefined) {
    return false;
  }
  
  // StringArray: order-insensitive comparison
  if (cellType === 'stringarray') {
    const arrA = Array.isArray(valueA) ? valueA : [];
    const arrB = Array.isArray(valueB) ? valueB : [];
    return areStringArraysEqual(arrA, arrB);
  }
  
  // MultiSelect (array of IDs): order-insensitive comparison
  if (cellType === 'multiselect' && Array.isArray(valueA) && Array.isArray(valueB)) {
    if (valueA.length !== valueB.length) return false;
    const setA = new Set(valueA);
    const setB = new Set(valueB);
    return setA.size === setB.size && Array.from(setA).every(val => setB.has(val));
  }
  
  // Default: simple equality
  return valueA === valueB;
};

