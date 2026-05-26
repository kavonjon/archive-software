/**
 * Item Import Value Parsers
 * 
 * Utilities for parsing and transforming raw spreadsheet values into batch editor values.
 */

import { Languoid, TitleWithLanguage } from './api';

/**
 * Item cache lookup interface
 * Used to resolve references during import
 */
export interface ItemCacheLookup {
  getByCatalogNumber: (catalogNumber: string) => Promise<any | null>;
  getLanguoidByGlottocode: (glottocode: string) => Promise<Languoid | null>;
  getLanguoidByName: (name: string) => Promise<Languoid | null>;
  getCollaboratorByFullName?: (fullName: string) => Promise<any | null>;
  getCollaboratorByNameWithoutNickname?: (name: string) => Promise<any[] | null>;
}

/**
 * Parse boolean value from various text representations
 * Supports: Yes/No, True/False, Y/N, T/F, 1/0
 */
export const parseBoolean = (rawValue: string): { value: boolean | null; text: string } => {
  const normalized = rawValue.trim().toLowerCase();
  
  // True values
  if (['yes', 'y', 'true', 't', '1'].includes(normalized)) {
    return { value: true, text: 'Yes' };
  }
  
  // False values
  if (['no', 'n', 'false', 'f', '0'].includes(normalized)) {
    return { value: false, text: 'No' };
  }
  
  // Not specified / null values
  if (['', 'null', 'not specified', 'n/a', 'na'].includes(normalized)) {
    return { value: null, text: 'Not specified' };
  }
  
  // Unrecognized - default to null
  console.warn(`[ItemImport] Unrecognized boolean value: "${rawValue}" - defaulting to "Not specified"`);
  return { value: null, text: 'Not specified' };
};

/**
 * Parse comma-separated values into array (for MultiSelectFields like genre, language_description_type)
 * NOW SUPPORTS mapping human-readable labels back to values
 * Returns array of trimmed non-empty strings
 * 
 * Examples:
 *   - With choices: "Drama, Conversation" → ['drama', 'conversation'] (maps labels to values)
 *   - Without choices: "value1, value2" → ['value1', 'value2'] (raw values)
 */
export const parseCommaSeparatedValues = (
  rawValue: string,
  choices?: Array<{ value: string; label: string }>
): { value: string[]; text: string; errors?: string[] } => {
  const parts = rawValue
    .split(',')
    .map(v => v.trim())
    .filter(v => v.length > 0);
  
  // If no choices provided, return raw values
  if (!choices || choices.length === 0) {
    const text = parts.join(', ');
    return { value: parts, text };
  }
  
  // Map human-readable labels to values
  const values: string[] = [];
  const errors: string[] = [];
  
  for (const part of parts) {
    // Try exact label match (case-insensitive)
    const labelMatch = choices.find(c => c.label.toLowerCase() === part.toLowerCase());
    if (labelMatch) {
      values.push(labelMatch.value);
      continue;
    }
    
    // Try exact value match (case-insensitive)
    const valueMatch = choices.find(c => c.value.toLowerCase() === part.toLowerCase());
    if (valueMatch) {
      values.push(valueMatch.value);
      continue;
    }
    
    // Try fuzzy label match
    const fuzzyMatch = choices.find(c => 
      c.label.toLowerCase().includes(part.toLowerCase()) ||
      part.toLowerCase().includes(c.label.toLowerCase())
    );
    if (fuzzyMatch) {
      values.push(fuzzyMatch.value);
      continue;
    }
    
    // No match found
    errors.push(`"${part}" not found in valid choices`);
  }
  
  // Generate display text from matched choices
  const text = values.map(v => {
    const choice = choices.find(c => c.value === v);
    return choice ? choice.label : v;
  }).join(', ');
  
  return { value: values, text, errors: errors.length > 0 ? errors : undefined };
};

/**
 * Parse select/choice field with fuzzy matching
 */
export const parseSelectChoice = (
  rawValue: string,
  choices: Array<{ value: string | boolean | null; label: string }>
): { value: any; text: string; errors?: string[] } => {
  const trimmed = rawValue.trim();
  const normalized = trimmed.toLowerCase();
  
  // Try exact value match first
  const exactMatch = choices.find(c => 
    String(c.value).toLowerCase() === normalized
  );
  if (exactMatch) {
    return { value: exactMatch.value, text: exactMatch.label };
  }
  
  // Try label match
  const labelMatch = choices.find(c => 
    c.label.toLowerCase() === normalized
  );
  if (labelMatch) {
    return { value: labelMatch.value, text: labelMatch.label };
  }
  
  // Try fuzzy match (partial)
  const fuzzyMatch = choices.find(c => 
    c.label.toLowerCase().includes(normalized) ||
    normalized.includes(c.label.toLowerCase())
  );
  if (fuzzyMatch) {
    return { value: fuzzyMatch.value, text: fuzzyMatch.label };
  }
  
  // Preserve raw value so user can see and fix it in the grid
  return {
    value: trimmed,
    text: trimmed,
    errors: [`"${trimmed}" is not a valid choice`],
  };
};

/**
 * Parse comma-separated languoid list
 * Supports both plain formats and export format: "Name (glottocode)"
 * 
 * Examples:
 *  - "Swahili (swah1253), English (stan1293)" → Matches by glottocode
 *  - "Swahili, English" → Matches by name (must be unique)
 *  - "swah1253, stan1293" → Matches by glottocode
 * 
 * Validation:
 *  - If glottocode provided but not found → error
 *  - If name provided and not unique → error
 *  - If name provided and not found → error
 */
export const parseCommaSeparatedLanguoids = async (
  rawValue: string,
  itemCache: ItemCacheLookup
): Promise<{ value: any[]; text: string; errors?: string[] }> => {
  const parts = rawValue.split(',').map(p => p.trim()).filter(p => p);
  const languoids: Array<{ id: number | null; name: string; glottocode: string | null }> = [];
  const errors: string[] = [];
  
  for (const part of parts) {
    let languoid: any | null = null;
    let glottocodeFromParens: string | null = null;
    let nameFromParens: string | null = null;
    
    // Check if this is export format: "Name (glottocode)"
    const exportFormatMatch = part.match(/^(.+?)\s*\(([a-z]{4}\d{4})\)$/);
    if (exportFormatMatch) {
      nameFromParens = exportFormatMatch[1].trim();
      glottocodeFromParens = exportFormatMatch[2].trim();
      
      // Try glottocode first (more reliable)
      languoid = await itemCache.getLanguoidByGlottocode(glottocodeFromParens);
      
      if (!languoid) {
        errors.push(`Glottocode "${glottocodeFromParens}" not found`);
        // Keep the invalid languoid with id: null so user can see what they imported
        languoids.push({
          id: null,
          name: nameFromParens,
          glottocode: glottocodeFromParens,
        });
        continue;
      }
    }
    // Check if this is plain glottocode (8-char format)
    else if (part.length === 8 && /^[a-z]{4}\d{4}$/.test(part)) {
      languoid = await itemCache.getLanguoidByGlottocode(part);
      
      if (!languoid) {
        errors.push(`Glottocode "${part}" not found`);
        // Keep the invalid glottocode with id: null
        languoids.push({
          id: null,
          name: part, // Use glottocode as name since we don't know the actual name
          glottocode: part,
        });
        continue;
      }
    }
    // Plain name format
    else {
      languoid = await itemCache.getLanguoidByName(part);
      
      if (!languoid) {
        errors.push(`Language "${part}" not found`);
        // Keep the invalid language with id: null
        languoids.push({
          id: null,
          name: part,
          glottocode: null,
        });
        continue;
      }
      
      // Check for uniqueness (name match must be unique)
      // Note: This is a simplified check - ideally itemCache would return null for non-unique matches
      // and we'd have a separate method to check uniqueness
    }
    
    if (languoid) {
      languoids.push({
        id: languoid.id,
        name: languoid.name,
        glottocode: languoid.glottocode,
      });
    }
  }
  
  // Format text to match export format: "Name (glottocode), Name (glottocode)"
  // Include invalid languoids in the text so user can see what they imported
  const text = languoids.map(l => {
    return l.glottocode ? `${l.name} (${l.glottocode})` : l.name;
  }).join(', ');
  return { value: languoids, text, errors: errors.length > 0 ? errors : undefined };
};

/**
 * Parse collaborators with roles and citation metadata
 * Format: "John Doe (Speaker, Collector; in citation), Jane Smith (Translator)"
 * 
 * Steps:
 * 1. Split by comma (except commas inside parentheses)
 * 2. For each collaborator:
 *    a. Extract name (before parentheses or whole string if no parens)
 *    b. Extract roles (inside parentheses, before semicolon)
 *    c. Extract citation flag ("; in citation" inside parentheses)
 * 3. Look up collaborator by exact full_name match
 * 4. If not found, try matching full_names + last_names + name_suffix (without nickname)
 * 5. If still not found or not unique → validation error
 * 
 * @param rawValue - Raw text from spreadsheet
 * @param itemCache - Cache with collaborator lookup methods
 * @param roleChoices - Valid role choices for mapping labels to values
 * @returns Parsed collaborator objects with errors
 */
export const parseCollaboratorsWithRoles = async (
  rawValue: string,
  itemCache: ItemCacheLookup,
  roleChoices: Array<{ value: string; label: string }>
): Promise<{ value: any[]; text: string; errors?: string[] }> => {
  // Split by comma, but respect parentheses
  // Use a simple regex-based approach: split by ", " but only outside parentheses
  const collaboratorParts: string[] = [];
  let currentPart = '';
  let parenDepth = 0;
  
  for (let i = 0; i < rawValue.length; i++) {
    const char = rawValue[i];
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    
    if (char === ',' && parenDepth === 0) {
      if (currentPart.trim()) {
        collaboratorParts.push(currentPart.trim());
      }
      currentPart = '';
    } else {
      currentPart += char;
    }
  }
  if (currentPart.trim()) {
    collaboratorParts.push(currentPart.trim());
  }
  
  const collaborators: any[] = [];
  const errors: string[] = [];
  
  for (const part of collaboratorParts) {
    // Parse format: "Name (Role1, Role2; in citation)" or "Name (Role1, Role2)" or "Name (in citation)" or "Name"
    const match = part.match(/^(.+?)(?:\s*\(([^)]*)\))?$/);
    if (!match) {
      errors.push(`Invalid format: "${part}"`);
      continue;
    }
    
    const name = match[1].trim();
    const metadataStr = match[2] ? match[2].trim() : '';
    
    // Parse roles and citation flag from metadata
    let rolesStr = metadataStr;
    let citationAuthor = false;
    
    if (metadataStr.includes('; in citation')) {
      citationAuthor = true;
      rolesStr = metadataStr.replace(/;\s*in citation\s*$/, '').trim();
    } else if (metadataStr === 'in citation') {
      citationAuthor = true;
      rolesStr = '';
    }
    
    // Parse roles (comma-separated labels inside parentheses)
    const roles: string[] = [];
    if (rolesStr) {
      const roleParts = rolesStr.split(',').map(r => r.trim()).filter(r => r);
      for (const rolePart of roleParts) {
        // Map human-readable label to value
        const roleMatch = roleChoices.find(rc => rc.label.toLowerCase() === rolePart.toLowerCase());
        if (roleMatch) {
          roles.push(roleMatch.value);
        } else {
          // Try value match
          const valueMatch = roleChoices.find(rc => rc.value.toLowerCase() === rolePart.toLowerCase());
          if (valueMatch) {
            roles.push(valueMatch.value);
          } else {
            errors.push(`Role "${rolePart}" not found for collaborator "${name}"`);
          }
        }
      }
    }
    
    // Look up collaborator by name
    let collaborator: any | null = null;
    
    // Try exact full_name match first
    if (itemCache.getCollaboratorByFullName) {
      collaborator = await itemCache.getCollaboratorByFullName(name);
    }
    
    // If not found, try matching without nickname
    if (!collaborator && itemCache.getCollaboratorByNameWithoutNickname) {
      const matches = await itemCache.getCollaboratorByNameWithoutNickname(name);
      
      if (matches && matches.length > 1) {
        // Non-unique match
        errors.push(`Name "${name}" matches multiple collaborators - please specify which one or edit manually`);
        continue;
      } else if (matches && matches.length === 1) {
        collaborator = matches[0];
      }
    }
    
    // If still not found, keep with id: null so user can see what they imported
    if (!collaborator) {
      errors.push(`Collaborator "${name}" not found`);
      // Keep the invalid collaborator with id: null
      collaborators.push({
        id: null,
        name: name,
        roles,
        citation_author: citationAuthor,
      });
      continue;
    }
    
    // Successfully found - add to list
    collaborators.push({
      id: collaborator.id,
      name: collaborator.full_name,
      roles,
      citation_author: citationAuthor,
    });
  }
  
  const text = rawValue; // Keep original text for now
  return { value: collaborators, text, errors: errors.length > 0 ? errors : undefined };
};

/**
 * Parse title with language
 * Format: "Title Text (Language Name)"
 * 
 * Steps:
 * 1. Extract title text (before parentheses or whole string if no parens)
 * 2. Extract language name (inside parentheses)
 * 3. Look up languoid by exact name match
 * 4. If not found or not unique → validation error
 * 
 * @param rawValue - Raw text from spreadsheet
 * @param itemCache - Cache with languoid lookup methods
 * @returns Parsed title object with language reference
 */
export const parseTitleWithLanguage = async (
  rawValue: string,
  itemCache: ItemCacheLookup
): Promise<{ value: any | null; text: string; errors?: string[] }> => {
  if (!rawValue || rawValue.trim() === '') {
    return { value: null, text: '' };
  }
  
  const errors: string[] = [];
  
  // Parse format: "Title Text (Language Name)"
  const match = rawValue.match(/^(.+?)(?:\s*\(([^)]+)\))?$/);
  if (!match) {
    return { value: null, text: rawValue, errors: [`Invalid format: "${rawValue}"`] };
  }
  
  const titleText = match[1].trim();
  const languageName = match[2] ? match[2].trim() : null;
  
  let languageId: number | null = null;
  let languageFullName: string | null = null;
  let languageGlottocode: string | null = null;
  
  if (languageName) {
    // Look up languoid by name (exact match)
    const languoid = await itemCache.getLanguoidByName(languageName);
    
    if (!languoid) {
      errors.push(`Language "${languageName}" not found`);
    } else {
      languageId = languoid.id;
      languageFullName = languoid.name;
      languageGlottocode = languoid.glottocode || null;
      
      // TODO: Check for uniqueness
      // If getLanguoidByName returns multiple matches, we need to show an error
    }
  }
  
  const value = {
    title: titleText,
    language: languageId ? {
      id: languageId,
      name: languageFullName,
      glottocode: languageGlottocode,
    } : null,
  };
  
  // Format display text
  const text = languageFullName ? `${titleText} (${languageFullName})` : titleText;
  
  return { value, text, errors: errors.length > 0 ? errors : undefined };
};

/**
 * True when a title_with_language cell value is empty (null, undefined, '', or no title text).
 */
export const isEmptyTitleWithLanguageValue = (value: unknown): boolean => {
  if (value == null || value === '') return true;
  if (typeof value === 'object' && value !== null && 'title' in value) {
    const titleText = (value as TitleWithLanguage).title;
    return titleText == null || String(titleText).trim() === '';
  }
  return false;
};

/**
 * Normalize batch title values for grid cells and import comparison.
 */
export const normalizeTitleWithLanguageValue = (
  value: unknown
): TitleWithLanguage | null => {
  if (isEmptyTitleWithLanguageValue(value)) return null;
  if (typeof value === 'object' && value !== null && 'title' in value) {
    const v = value as TitleWithLanguage;
    return {
      title: v.title,
      language: v.language ?? null,
    };
  }
  return null;
};

/**
 * Display text for title_with_language cells — matches ItemBatchEditor.itemToRow.
 */
export const formatTitleWithLanguageDisplay = (value: unknown): string => {
  const normalized = normalizeTitleWithLanguageValue(value);
  if (!normalized) return '';
  const langName = normalized.language?.name || '';
  return langName ? `${normalized.title} (${langName})` : normalized.title;
};

/** Detail API may return plain string; batch API returns TitleWithLanguage object */
export const formatPrimaryTitleDisplay = (
  value: TitleWithLanguage | string | null | undefined
): string => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  return formatTitleWithLanguageDisplay(value);
};

/**
 * Compare two cell values for equality
 * Handles arrays (order-insensitive), objects, and primitives
 */
export const areCellValuesEqual = (a: any, b: any): boolean => {
  // Empty title_with_language: null, undefined, '', and legacy '' from import row builder
  if (isEmptyTitleWithLanguageValue(a) || isEmptyTitleWithLanguageValue(b)) {
    return isEmptyTitleWithLanguageValue(a) && isEmptyTitleWithLanguageValue(b);
  }

  const titleA = normalizeTitleWithLanguageValue(a);
  const titleB = normalizeTitleWithLanguageValue(b);
  if (titleA && titleB) {
    if (titleA.title !== titleB.title) return false;
    if (titleA.language == null && titleB.language == null) return true;
    if (titleA.language == null || titleB.language == null) return false;
    return titleA.language.id === titleB.language.id;
  }

  // Both null/undefined (non-title fields)
  if (a == null && b == null) return true;
  
  // One is null, other is not
  if (a == null || b == null) return false;
  
  // Array comparison (order-insensitive)
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    
    // For arrays of objects (like languoids), compare by id
    if (a.length > 0 && typeof a[0] === 'object' && a[0] !== null) {
      const aIds = a.map((item: any) => item.id || item).sort();
      const bIds = b.map((item: any) => item.id || item).sort();
      return JSON.stringify(aIds) === JSON.stringify(bIds);
    }
    
    // For primitive arrays, sort and compare
    const aSorted = [...a].sort();
    const bSorted = [...b].sort();
    return JSON.stringify(aSorted) === JSON.stringify(bSorted);
  }
  
  // Object comparison (by id if available)
  if (typeof a === 'object' && typeof b === 'object') {
    if ('id' in a && 'id' in b) {
      return a.id === b.id;
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }
  
  // Primitive comparison
  return a === b;
};


