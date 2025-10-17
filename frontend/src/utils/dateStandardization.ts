/**
 * Date Standardization Utilities
 * 
 * IMPORTANT: This code mirrors the date transformation logic in the Django backend.
 * 
 * Backend location: app/metadata/signals.py - standardize_date_format() function
 * 
 * Any changes to date transformation logic should be kept in sync between:
 * - Frontend: frontend/src/utils/dateStandardization.ts (this file)
 * - Backend: app/metadata/signals.py - standardize_date_format()
 * 
 * The logic was originally extracted from: app/metadata/management/commands/standardize_date_formats.py
 */

export interface DateInterpretationResult {
  status: 'empty' | 'preferred' | 'convertible' | 'unrecognized';
  message: string;
  convertedValue?: string;
}

/**
 * Standardize date string using the same logic as the Django backend.
 * Converts American MM/DD/YYYY formats to YYYY/MM/DD formats.
 * Preserves already standardized YYYY-first formats.
 * 
 * This function mirrors: app/metadata/signals.py - standardize_date_format()
 */
export function standardizeDateFormat(dateStr: string): string {
  if (!dateStr) {
    return dateStr;
  }

  // YYYY format (preserve as is)
  const yearOnly = /^(\d{4})$/.exec(dateStr);
  if (yearOnly) {
    return dateStr;
  }

  // YYYY-YYYY format (preserve as is)
  const yearRange = /^(\d{4})-(\d{4})$/.exec(dateStr);
  if (yearRange) {
    return dateStr;
  }

  // YYYY/MM-YYYY/MM format (already standardized - preserve as is)
  // This matches both zero-padded (YYYY/MM) and non-padded (YYYY/M) formats
  const standardizedMonthYearRange = /^(\d{4})\/(\d{1,2})-(\d{4})\/(\d{1,2})$/.exec(dateStr);
  if (standardizedMonthYearRange) {
    return dateStr;
  }

  // YYYY/MM/DD-YYYY/MM/DD format (already standardized - preserve as is)
  // This matches both zero-padded and non-padded formats
  const standardizedFullDateRange = /^(\d{4})\/(\d{1,2})\/(\d{1,2})-(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(dateStr);
  if (standardizedFullDateRange) {
    return dateStr;
  }

  // YYYY/MM format (already standardized - preserve as is)
  // This matches both zero-padded and non-padded formats
  const standardizedMonthYear = /^(\d{4})\/(\d{1,2})$/.exec(dateStr);
  if (standardizedMonthYear) {
    return dateStr;
  }

  // YYYY/MM/DD format (already standardized - preserve as is)
  // This matches both zero-padded and non-padded formats
  const standardizedFullDate = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(dateStr);
  if (standardizedFullDate) {
    return dateStr;
  }

  // MM/YYYY-MM/YYYY format → YYYY/MM-YYYY/MM
  const monthYearRange = /^(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (monthYearRange) {
    const [, month1, year1, month2, year2] = monthYearRange;
    return `${year1}/${month1.padStart(2, '0')}-${year2}/${month2.padStart(2, '0')}`;
  }

  // MM/DD/YYYY-MM/DD/YYYY format → YYYY/MM/DD-YYYY/MM/DD
  const fullDateRange = /^(\d{1,2})\/(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (fullDateRange) {
    const [, month1, day1, year1, month2, day2, year2] = fullDateRange;
    return `${year1}/${month1.padStart(2, '0')}/${day1.padStart(2, '0')}-${year2}/${month2.padStart(2, '0')}/${day2.padStart(2, '0')}`;
  }

  // MM/DD/YYYY format → YYYY/MM/DD
  const fullDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (fullDate) {
    const [, month, day, year] = fullDate;
    return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
  }

  // MM/YYYY format → YYYY/MM
  const monthYear = /^(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (monthYear) {
    const [, month, year] = monthYear;
    return `${year}/${month.padStart(2, '0')}`;
  }

  // If no conversion patterns match, return original
  return dateStr;
}

/**
 * Interpret date input and provide user feedback about what will happen on save.
 * 
 * This function uses the same logic as the Django backend to predict transformation behavior.
 */
export function interpretDateInput(value: string): DateInterpretationResult {
  if (!value || value.trim() === '') {
    return {
      status: 'empty',
      message: ''
    };
  }

  const trimmedValue = value.trim();
  const standardized = standardizeDateFormat(trimmedValue);

  if (standardized === trimmedValue) {
    // Check if it's in a preferred YYYY-first format
    const isPreferredFormat = /^(\d{4}(\/\d{1,2})?(\/\d{1,2})?(-\d{4}(\/\d{1,2})?(\/\d{1,2})?)?)$/.test(trimmedValue);
    
    if (isPreferredFormat) {
      return {
        status: 'preferred',
        message: '✓ Already in preferred format',
        convertedValue: trimmedValue
      };
    } else {
      return {
        status: 'unrecognized',
        message: '? Format not recognized - will be saved as-is',
        convertedValue: trimmedValue
      };
    }
  } else {
    return {
      status: 'convertible',
      message: `→ Will become "${standardized}" on save`,
      convertedValue: standardized
    };
  }
}
