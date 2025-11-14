/**
 * File Parser Service
 * 
 * Parses Excel (.xlsx, .xls) and CSV files into structured data for import.
 */

import * as XLSX from 'xlsx';
import { hasValidColumns as hasValidLanguoidColumns } from './importColumnMapper';

export interface ParsedSpreadsheetData {
  /** Raw column headers from file */
  headers: string[];
  
  /** Each row as key-value pairs (column name → raw string value) */
  rows: Array<Record<string, string>>;
  
  /** Number of data rows (excluding header) */
  rowCount: number;
  
  /** Type of file parsed */
  fileType: 'excel' | 'csv';
}

export interface FileValidationResult {
  /** Whether the file is valid for import */
  valid: boolean;
  
  /** Error message if invalid */
  error?: string;
  
  /** Non-blocking warnings (e.g., large file) */
  warnings?: string[];
  
  /** File type detected */
  fileType?: 'excel' | 'csv';
  
  /** File size in bytes */
  fileSize?: number;
  
  /** Number of data rows */
  rowCount?: number;
  
  /** Number of valid (recognized) columns */
  validColumnCount?: number;
}

// Configuration constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const LARGE_FILE_ROW_THRESHOLD = 1000;

/**
 * Detect file type from filename or MIME type
 */
const detectFileType = (file: File): 'excel' | 'csv' | null => {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return 'excel';
  }
  
  if (fileName.endsWith('.csv')) {
    return 'csv';
  }
  
  // Fall back to MIME type
  if (file.type === 'text/csv') {
    return 'csv';
  }
  
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  
  return null;
};

/**
 * Validate file before parsing
 * @param file File to validate
 * @param hasValidColumns Optional custom column validator (defaults to Languoid validator)
 * @param modelName Optional model name for error messages (defaults to "Languoid")
 */
export const validateFile = async (
  file: File,
  hasValidColumns?: (headers: string[]) => boolean,
  modelName: string = 'Languoid'
): Promise<FileValidationResult> => {
  const warnings: string[] = [];
  
  // Default to Languoid validator if not provided
  const columnValidator = hasValidColumns || hasValidLanguoidColumns;
  
  // Get example columns based on model
  const exampleColumns = modelName === 'Collaborator'
    ? 'Collaborator ID, First and Middle Name(s), Last Name(s), Native/First Languages, etc.'
    : 'Name, Glottocode, Level (Glottolog), Parent Languoid Glottocode, etc.';
  
  // Check file type
  const fileType = detectFileType(file);
  if (!fileType) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.',
    };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
      fileSize: file.size,
    };
  }
  
  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File appears to be empty.',
      fileSize: 0,
    };
  }
  
  // Quick parse to check structure (without full validation)
  try {
    const data = fileType === 'excel' 
      ? await parseExcelFile(file)
      : await parseCSVFile(file);
    
    // Check for headers
    if (data.headers.length === 0) {
      return {
        valid: false,
        error: 'File must have a header row with column names.',
        fileType,
        fileSize: file.size,
      };
    }
    
    // Check for at least one valid column
    if (!columnValidator(data.headers)) {
      return {
        valid: false,
        error: `No recognized columns found in file. Please ensure the file contains columns like: ${exampleColumns}`,
        fileType,
        fileSize: file.size,
      };
    }
    
    // Check for data rows
    if (data.rowCount === 0) {
      return {
        valid: false,
        error: 'File contains headers but no data rows.',
        fileType,
        fileSize: file.size,
      };
    }
    
    // Warning for large files
    if (data.rowCount > LARGE_FILE_ROW_THRESHOLD) {
      warnings.push(
        `This file contains ${data.rowCount} rows. Import and validation may take several minutes.`
      );
    }
    
    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      fileType,
      fileSize: file.size,
      rowCount: data.rowCount,
    };
    
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Could not parse file. Please ensure it is a valid Excel or CSV file.',
      fileType,
      fileSize: file.size,
    };
  }
};

/**
 * Parse Excel file (.xlsx, .xls)
 */
export const parseExcelFile = async (file: File): Promise<ParsedSpreadsheetData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file contents'));
          return;
        }
        
        // Parse workbook
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Workbook contains no sheets'));
          return;
        }
        
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON (array of objects)
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,        // Return formatted strings (not raw values)
          defval: '',        // Default value for empty cells
          blankrows: false,  // Skip blank rows
        });
        
        if (jsonData.length === 0) {
          reject(new Error('Sheet contains no data'));
          return;
        }
        
        // Extract headers (keys from first object)
        const headers = Object.keys(jsonData[0]);
        
        // Convert to row format (array of records)
        const rows: Array<Record<string, string>> = jsonData.map(row => {
          const record: Record<string, string> = {};
          headers.forEach(header => {
            // Convert all values to strings, trim whitespace
            const value = row[header];
            record[header] = value !== null && value !== undefined 
              ? String(value).trim() 
              : '';
          });
          return record;
        });
        
        resolve({
          headers,
          rows,
          rowCount: rows.length,
          fileType: 'excel',
        });
        
      } catch (error: any) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parse CSV file
 */
export const parseCSVFile = async (file: File): Promise<ParsedSpreadsheetData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error('Failed to read file contents'));
          return;
        }
        
        // Split into lines
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }
        
        if (lines.length === 1) {
          reject(new Error('CSV file contains only a header row (no data)'));
          return;
        }
        
        // Parse CSV (simple parser - assumes comma-separated, no quotes)
        // For production, consider using a library like papaparse
        const parseCSVLine = (line: string): string[] => {
          // Handle quoted values with commas inside
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              // Toggle quote state
              if (inQuotes && line[i + 1] === '"') {
                // Escaped quote ("")
                current += '"';
                i++; // Skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              // End of field
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          // Push last field
          result.push(current.trim());
          
          return result;
        };
        
        // Extract headers (first line)
        const headers = parseCSVLine(lines[0]);
        
        // Parse data rows
        const rows: Array<Record<string, string>> = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          
          // Create record (map headers to values)
          const record: Record<string, string> = {};
          headers.forEach((header, index) => {
            record[header] = values[index] || '';
          });
          
          rows.push(record);
        }
        
        resolve({
          headers,
          rows,
          rowCount: rows.length,
          fileType: 'csv',
        });
        
      } catch (error: any) {
        reject(new Error(`Failed to parse CSV file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

