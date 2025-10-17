import { interpretDateInput, DateInterpretationResult } from '../utils/dateStandardization';

/**
 * React hook for date input interpretation.
 * 
 * Provides real-time feedback about what will happen to date input on save.
 * Uses the same logic as Django backend for consistent behavior prediction.
 * 
 * Backend mirror: app/metadata/signals.py - standardize_date_format()
 */
export function useDateInterpretation(value: string): DateInterpretationResult {
  // Remove useMemo to prevent re-renders on every keystroke
  // This was causing the cursor jumping issue
  return interpretDateInput(value);
}
