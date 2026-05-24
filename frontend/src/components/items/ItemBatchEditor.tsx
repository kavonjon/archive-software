/**
 * Stage 1 Phase 2: Item Batch Editor
 * 
 * Model-specific wrapper for batch editing Items
 * Provides column configuration and item-specific logic
 * 
 * Key Features:
 * - Complex CollaboratorRole through model with roles (MultiSelectField) and citation_author (boolean)
 * - Custom cell editor for collaborator-role associations
 * - M2M language relationships
 * - Text and choice field editing
 */

import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Box, 
  Alert, 
  Snackbar, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { AdaptiveSpreadsheetGrid } from '../batch';
import { ColumnConfig, SpreadsheetRow, SpreadsheetCell } from '../../types/spreadsheet';
import { RootState } from '../../store/store';
import {
  initializeSpreadsheet,
  updateCell,
  batchUpdateCells,
  undo,
  redo,
  clearHistory,
  toggleRowSelection,
  toggleAllRowSelection,
  selectRowRange,
  clearAllSelections,
  setLoading,
  setError,
  setSuccessMessage,
  addDraftRow,
  resetSpreadsheet,
  setSaving,
  updateRowAfterSave,
} from '../../store/batchSpreadsheetSlice';
import { itemsAPI, Item, Languoid, languoidsAPI, RESOURCE_TYPE_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, LANGUAGE_DESCRIPTION_TYPE_CHOICES, ROLE_CHOICES } from '../../services/api';
import { useItemCache } from '../../contexts/ItemCacheContext';
import { useImportItemSpreadsheet } from '../../hooks/useImportItemSpreadsheet';
import { v4 as uuidv4 } from 'uuid';

// Collaborator role-related types
interface CollaboratorWithRoles {
  id: number;
  name: string;
  roles: string[];
  citation_author: boolean;
}

// Title with language types (for ItemTitle management)
interface TitleWithLanguage {
  title: string;
  language: {
    id: number;
    name: string;
    glottocode: string;
  } | null;
}

// Column configuration for Items (production - all editable fields)
const ITEM_COLUMNS: ColumnConfig[] = [
  // ============================================================================
  // CORE IDENTIFICATION & METADATA
  // ============================================================================
  {
    fieldName: 'catalog_number',
    header: 'Catalog Number',
    cellType: 'text',
    width: 180,
    required: true,
  },
  {
    fieldName: 'item_access_level',
    header: 'Access Level',
    cellType: 'select',
    width: 150,
    choices: [
      { value: '1', label: '1 - Open Access' },
      { value: '2', label: '2 - Materials are available to view onsite but no copies may be distributed' },
      { value: '3', label: '3 - Access protected by a time limit' },
      { value: '4', label: '4 - Depositor (or someone else) controls access to the resource' },
    ],
  },
  {
    fieldName: 'primary_title',
    header: 'Default Title',
    cellType: 'title_with_language',
    width: 300,
    metadata: { isDefaultTitle: true }, // Indicates this manages ItemTitle with default=True
  },
  {
    fieldName: 'secondary_title',
    header: 'First Additional Title',
    cellType: 'title_with_language',
    width: 300,
    metadata: { isDefaultTitle: false }, // Indicates this manages ItemTitle with default=False
  },
  {
    fieldName: 'description_scope_and_content',
    header: 'Description',
    cellType: 'text',
    width: 300,
  },
  {
    fieldName: 'resource_type',
    header: 'Resource Type',
    cellType: 'select',
    width: 200,
    choices: RESOURCE_TYPE_CHOICES,
  },
  {
    fieldName: 'call_number',
    header: 'Call Number',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'associated_ephemera',
    header: 'Associated Ephemera',
    cellType: 'text',
    width: 250,
  },
  
  // ============================================================================
  // RELATIONSHIPS
  // ============================================================================
  {
    fieldName: 'language',
    header: 'Languages',
    cellType: 'multiselect',
    width: 250,
    relationshipEndpoint: '/internal/v1/languoids/',
  },
  {
    fieldName: 'collaborators',
    header: 'Collaborators (Role, Citation)',
    cellType: 'collaborator_roles', // Complex through-model with roles and citation metadata
    width: 350,
  },
  
  // ============================================================================
  // DATES (using text cellType with validation pattern)
  // ============================================================================
  {
    fieldName: 'creation_date',
    header: 'Creation Date',
    cellType: 'text',
    width: 150,
  },
  
  // ============================================================================
  // CONTENT CLASSIFICATION
  // ============================================================================
  {
    fieldName: 'genre',
    header: 'Genre',
    cellType: 'multiselect',
    width: 250,
    choices: GENRE_CHOICES,
    // Backend handles MultiSelectField - values stored as array
  },
  {
    fieldName: 'language_description_type',
    header: 'Language Description Type',
    cellType: 'multiselect',
    width: 250,
    choices: LANGUAGE_DESCRIPTION_TYPE_CHOICES,
    // Backend handles MultiSelectField - values stored as array
  },
  {
    fieldName: 'access_level_restrictions',
    header: 'Access Level Restrictions',
    cellType: 'text',
    width: 250,
  },
  
  // ============================================================================
  // ACCESSION & ACQUISITION
  // ============================================================================
  {
    fieldName: 'accession_number',
    header: 'Accession Number',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'accession_date',
    header: 'Accession Date',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'type_of_accession',
    header: 'Type of Accession',
    cellType: 'select',
    width: 220,
    choices: ACCESSION_CHOICES,
  },
  {
    fieldName: 'acquisition_notes',
    header: 'Acquisition Notes',
    cellType: 'text',
    width: 250,
  },
  
  // ============================================================================
  // COLLECTION & COLLECTOR INFO
  // ============================================================================
  {
    fieldName: 'collector_name',
    header: 'Collector Name',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'collector_info',
    header: 'Collector Info',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'collection_date',
    header: 'Collection Date',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'collecting_notes',
    header: 'Collecting Notes',
    cellType: 'text',
    width: 250,
  },
  
  // ============================================================================
  // DEPOSIT INFO
  // ============================================================================
  {
    fieldName: 'depositor_name',
    header: 'Depositor Name',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'depositor_contact_information',
    header: 'Depositor Contact Information',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'deposit_date',
    header: 'Deposit Date',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'project_grant',
    header: 'Project Grant',
    cellType: 'text',
    width: 200,
  },
  
  // ============================================================================
  // PHYSICAL CONDITION & AVAILABILITY
  // ============================================================================
  {
    fieldName: 'availability_status',
    header: 'Availability Status',
    cellType: 'select',
    width: 180,
    choices: AVAILABILITY_CHOICES,
  },
  {
    fieldName: 'availability_status_notes',
    header: 'Availability Status Notes',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'condition',
    header: 'Condition',
    cellType: 'select',
    width: 150,
    choices: CONDITION_CHOICES,
  },
  {
    fieldName: 'condition_notes',
    header: 'Condition Notes',
    cellType: 'text',
    width: 250,
  },
  
  // ============================================================================
  // FORMAT & TECHNICAL
  // ============================================================================
  {
    fieldName: 'original_format_medium',
    header: 'Original Format Medium',
    cellType: 'select',
    width: 180,
    choices: FORMAT_CHOICES,
  },
  {
    fieldName: 'location_of_original',
    header: 'Location of Original',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'other_institutional_number',
    header: 'Other Institutional Number',
    cellType: 'text',
    width: 200,
  },
  
  // ============================================================================
  // CONSERVATION
  // ============================================================================
  {
    fieldName: 'conservation_recommendation',
    header: 'Conservation Recommendation',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'conservation_treatments_performed',
    header: 'Conservation Treatments Performed',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'equipment_used',
    header: 'Equipment Used',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'software_used',
    header: 'Software Used',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'ipm_issues',
    header: 'IPM Issues',
    cellType: 'text',
    width: 200,
  },
  
  // ============================================================================
  // GEOGRAPHIC LOCATION
  // ============================================================================
  {
    fieldName: 'municipality_or_township',
    header: 'Municipality or Township',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'county_or_parish',
    header: 'County or Parish',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'state_or_province',
    header: 'State or Province',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'country_or_territory',
    header: 'Country or Territory',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'global_region',
    header: 'Global Region',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'recording_context',
    header: 'Recording Context',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'public_event',
    header: 'Public Event',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'recorded_on',
    header: 'Recorded On',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'latitude',
    header: 'Latitude',
    cellType: 'decimal',
    width: 120,
  },
  {
    fieldName: 'longitude',
    header: 'Longitude',
    cellType: 'decimal',
    width: 120,
  },
  
  // ============================================================================
  // PUBLICATION INFO
  // ============================================================================
  {
    fieldName: 'publisher',
    header: 'Publisher',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'publisher_address',
    header: 'Publisher Address',
    cellType: 'text',
    width: 250,
  },
  {
    fieldName: 'isbn',
    header: 'ISBN',
    cellType: 'text',
    width: 150,
  },
  {
    fieldName: 'loc_catalog_number',
    header: 'LOC Catalog Number',
    cellType: 'text',
    width: 180,
  },
  {
    fieldName: 'total_number_of_pages_and_physical_description',
    header: 'Total Number of Pages and Physical Description',
    cellType: 'text',
    width: 300,
  },
  
  // ============================================================================
  // EXTERNAL REFERENCES
  // ============================================================================
  {
    fieldName: 'temporary_accession_number',
    header: 'Temporary Accession Number',
    cellType: 'text',
    width: 200,
  },
  {
    fieldName: 'lender_loan_number',
    header: 'Lender Loan Number',
    cellType: 'text',
    width: 180,
  },
  {
    fieldName: 'other_information',
    header: 'Other Information',
    cellType: 'text',
    width: 300,
  },
];

/**
 * Helper to format languoid array display text
 * Format: "Name (glottocode), Name (glottocode)"
 */
const formatLanguoidArrayDisplay = (languoids: Languoid[]): string => {
  if (!languoids || languoids.length === 0) return '';
  return languoids.map(lang => {
    return lang.glottocode ? `${lang.name} (${lang.glottocode})` : lang.name;
  }).join(', ');
};

/**
 * Helper to format collaborators with roles display text
 * Format: "Name (role, role; in citation), Name (role, role), Name (in citation), Name"
 */
const formatCollaboratorsDisplay = (collaborators: CollaboratorWithRoles[]): string => {
  if (!collaborators || collaborators.length === 0) return '';
  return collaborators.map(collab => {
    const hasRoles = collab.roles.length > 0;
    const isCitation = collab.citation_author;
    
    // Convert role values to human-readable labels
    const roleLabels = collab.roles.map(roleValue => {
      const roleChoice = ROLE_CHOICES.find(rc => rc.value === roleValue);
      return roleChoice ? roleChoice.label : roleValue;
    });
    
    if (hasRoles && isCitation) {
      // Name (Role Label, Role Label; in citation)
      return `${collab.name} (${roleLabels.join(', ')}; in citation)`;
    } else if (hasRoles && !isCitation) {
      // Name (Role Label, Role Label)
      return `${collab.name} (${roleLabels.join(', ')})`;
    } else if (!hasRoles && isCitation) {
      // Name (in citation)
      return `${collab.name} (in citation)`;
    } else {
      // Name
      return collab.name;
    }
  }).join(', ');
};

/**
 * Convert an Item API object to a SpreadsheetRow
 */
const itemToRow = (item: Item): SpreadsheetRow => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  ITEM_COLUMNS.forEach(col => {
    const fieldName = col.fieldName;
    let value = (item as any)[fieldName];
    
    let displayValue = value?.toString() || '';
    
    // Handle boolean fields
    if (col.cellType === 'boolean') {
      if (value === null || value === undefined) {
        displayValue = 'Not specified';
      } else {
        displayValue = value ? 'Yes' : 'No';
      }
    }
    
    // Handle multiselect languoid fields (M2M)
    if (fieldName === 'language') {
      if (Array.isArray(value)) {
        const languoids = value as Languoid[];
        displayValue = formatLanguoidArrayDisplay(languoids);
        // Store minimal data for the multiselect editor
        value = languoids.map(lang => ({ 
          id: lang.id, 
          name: lang.name,
          glottocode: lang.glottocode 
        })) as any;
      } else {
        displayValue = '';
        value = [] as any;
      }
    }
    
    // Handle MultiSelectFields (genre, language_description_type)
    if (fieldName === 'genre' || fieldName === 'language_description_type') {
      if (Array.isArray(value) && value.length > 0) {
        // Map values to human-readable labels
        const choices = fieldName === 'genre' ? GENRE_CHOICES : LANGUAGE_DESCRIPTION_TYPE_CHOICES;
        displayValue = value.map((v: string) => {
          const choice = choices.find(c => c.value === v);
          return choice ? choice.label : v;
        }).join(', ');
      } else {
        displayValue = '';
        value = [];
      }
    }
    
    // For Decimal fields (latitude, longitude), ensure value is string
    if (col.cellType === 'decimal') {
      if (value !== null && value !== undefined && value !== '') {
        // Convert number to string
        value = String(value);
        displayValue = String(value);
      } else {
        value = '';
        displayValue = '';
      }
    }
    
    // Handle custom collaborators field (complex through model)
    if (fieldName === 'collaborators') {
      // Value comes from serializer as: [{ id, name, roles: [...], citation_author: bool }, ...]
      if (Array.isArray(value)) {
        const collaborators = value as CollaboratorWithRoles[];
        displayValue = formatCollaboratorsDisplay(collaborators);
        // Keep the full structure for the custom editor
      } else {
        displayValue = '';
        value = [] as any;
      }
    }
    
    // Handle title fields (ItemTitle management with language)
    if (fieldName === 'primary_title' || fieldName === 'secondary_title') {
      // Value comes from serializer as: { title: string, language: { id, name, glottocode } } | null
      if (value && typeof value === 'object' && (value as any).title) {
        const titleData = value as TitleWithLanguage;
        // Format display: "Title Text (Language Name)" or just "Title Text" if no language
        const langName = titleData.language?.name || '';
        displayValue = langName ? `${titleData.title} (${langName})` : titleData.title;
        // Keep the full structure for the editor
      } else {
        displayValue = '';
        value = null;
      }
    }
    
    // Handle select fields - store value and display label
    if (col.cellType === 'select' && col.choices && value) {
      const choice = col.choices.find(c => c.value === value);
      if (choice) {
        displayValue = choice.label;
      }
    }
    
    // Handle collection (foreign key) - display the name
    if (fieldName === 'collection' && value && typeof value === 'object') {
      displayValue = (value as any).name || '';
      value = (value as any).id; // Store the ID
    }
    
    cells[col.fieldName] = {
      text: displayValue,
      value: value,
      type: col.cellType,
      isEdited: false,
      originalValue: value,
      validationState: 'valid',
      hasConflict: false,
      fieldName: col.fieldName,
      readOnly: col.readOnly,
    };
  });
  
  return {
    id: item.id,
    cells,
    isDraft: false,
    hasChanges: false,
    hasErrors: false,
    version: 1,
    _updated: item.updated, // Store DB timestamp for conflict detection
  };
};

/**
 * Create a new draft row for adding an item
 */
const createDraftRow = async (existingRows: SpreadsheetRow[]): Promise<SpreadsheetRow> => {
  const cells: Record<string, SpreadsheetCell> = {};
  
  ITEM_COLUMNS.forEach(col => {
    const defaultValue = null;
    const defaultText = '';
    
    cells[col.fieldName] = {
      text: defaultText,
      value: defaultValue,
      type: col.cellType,
      isEdited: false,
      originalValue: null,  // DB has no value for this row yet
      validationState: 'valid',
      hasConflict: false,
      fieldName: col.fieldName,
      readOnly: col.readOnly,
    };
  });
  
  return {
    id: `draft-${uuidv4()}`,
    cells,
    isDraft: true,
    hasChanges: false,  // Don't count as changed until user actually edits
    hasErrors: false,
  };
};

export const ItemBatchEditor: React.FC = () => {
  const dispatch = useDispatch();
  
  // Cache hook
  const { getItems, cache, isLoading: cacheLoading, loadProgress, refreshCache } = useItemCache();
  
  // Import hook
  const itemImportHook = useImportItemSpreadsheet();
  
  // Local state for refresh confirmation dialog
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  
  // Local state for save all confirmation dialog
  const [showSaveAllConfirm, setShowSaveAllConfirm] = useState(false);
  
  // Local state for validation error dialog
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [validationErrorRows, setValidationErrorRows] = useState<Array<{ rowNumber: number; name: string; errors: string[] }>>([]);
  
  // State to track newly added row for auto-scrolling
  const [scrollToRowId, setScrollToRowId] = useState<string | number | null>(null);
  
  // State for shared languoid options (for title editors)
  const [languoidOptions, setLanguoidOptions] = useState<Languoid[]>([]);
  const [loadingLanguoids, setLoadingLanguoids] = useState(false);
  
  // Get spreadsheet state from Redux
  const {
    rows,
    loading,
    saving,
    error,
    successMessage,
    undoStack,
    redoStack,
  } = useSelector((state: RootState) => state.batchSpreadsheet);
  
  // Compute derived values
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const anyChanges = rows.some(r => r.hasChanges);
  
  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');
  
  // Track if initial load is done
  const initialLoadDone = useRef(false);
  
  // Track if we're in empty mode (started with no rows)
  const isEmptyMode = useRef(false);
  
  // Track the IDs that should be in this batch editing session
  // This gets updated when new rows are saved and is used on refresh
  const sessionIds = useRef<Set<number>>(new Set());
  
  // Ref to track current rows (for preserving drafts during reload without triggering re-renders)
  const rowsRef = useRef<SpreadsheetRow[]>([]);
  
  // Keep ref in sync with Redux rows
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  
  // Load languoid options once on mount (for title editors)
  useEffect(() => {
    const loadLanguoids = async () => {
      setLoadingLanguoids(true);
      try {
        // Fetch ALL languages directly (not paginated)
        // Filter to only Languages (level_glottolog='language')
        const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
        const url = `${baseUrl}/internal/v1/languoids/?level_glottolog=language&page_size=10000`;
        
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        if (!response.ok) throw new Error('Failed to fetch languoids');
        
        const data = await response.json();
        const results = data.results || data;
        setLanguoidOptions(Array.isArray(results) ? results : []);
        console.log('[ItemBatchEditor] Loaded', results.length, 'language options for title editors');
      } catch (error) {
        console.error('[ItemBatchEditor] Error loading languoids:', error);
      } finally {
        setLoadingLanguoids(false);
      }
    };
    
    loadLanguoids();
  }, []);
  
  // Create columns with dynamic metadata (languoid options for title editors)
  const columnsWithMetadata = useMemo(() => {
    return ITEM_COLUMNS.map(col => {
      if (col.fieldName === 'primary_title' || col.fieldName === 'secondary_title') {
        return {
          ...col,
          metadata: {
            ...col.metadata,
            languoidOptions,
            loadingLanguoids,
          },
        };
      }
      return col;
    });
  }, [languoidOptions, loadingLanguoids]);
  
  /**
   * Load items from cache (filtered by IDs from session storage)
   * @param preserveDrafts - Whether to preserve existing draft rows (default: true for auto-refresh, false for manual refresh)
   */
  const loadItems = useCallback(async (preserveDrafts: boolean = true) => {
    try {
      dispatch(setLoading(true));
      
      // Check for new format config first
      const configStr = sessionStorage.getItem('item-batch-config');
      
      if (configStr) {
        const config = JSON.parse(configStr);
        // NOTE: Keep config in sessionStorage as source of truth for the session
        // Only remove it on unmount (cleanup function below)
        
        // Handle empty mode
        if (config.mode === 'empty') {
          console.log('[ItemBatchEditor] Empty mode - initializing with empty grid');
          isEmptyMode.current = true;
          sessionIds.current = new Set();
          dispatch(initializeSpreadsheet({
            modelName: 'Item',
            rows: [],
          }));
          dispatch(setLoading(false));
          initialLoadDone.current = true;
          return;
        }
        
        // Get items from cache (cache should be ready - list page waits for it)
        console.log('[ItemBatchEditor] Getting items from cache...');
        let allItems = await getItems();
        console.log('[ItemBatchEditor] Cache returned', allItems.length, 'total items');
        
        // Store the initial IDs in sessionIds
        sessionIds.current = new Set(config.ids || []);
        console.log('[ItemBatchEditor] Initialized sessionIds with', sessionIds.current.size, 'IDs');
        
        // Create a map of ID -> item for quick lookup
        const itemMap = new Map(allItems.map(item => [item.id, item]));
        
        // Convert to rows in the order specified by config.ids (preserve list page order)
        console.log('[ItemBatchEditor] Converting to rows...');
        const newRows: SpreadsheetRow[] = [];
        
        if (config.ids && config.ids.length > 0) {
          // Iterate through config.ids to preserve order
          for (const id of config.ids) {
            const item = itemMap.get(id);
            if (item) {
              newRows.push(itemToRow(item));
            }
          }
        } else {
          // No specific IDs - use all items
          newRows.push(...allItems.map(itemToRow));
        }
        
        console.log('[ItemBatchEditor] Converted', newRows.length, 'rows');
        
        // Preserve any existing draft rows (add them at the end)
        if (preserveDrafts) {
          const existingDraftRows = rowsRef.current.filter(r => r.isDraft);
          console.log('[ItemBatchEditor] Preserving', existingDraftRows.length, 'draft rows');
          newRows.push(...existingDraftRows);
        }
        
        // Initialize spreadsheet
        dispatch(initializeSpreadsheet({
          modelName: 'Item',
          rows: newRows,
        }));
        
        initialLoadDone.current = true;
        
      } else {
        // No config in sessionStorage - this is a refresh
        
        // Check if we have sessionIds from a previous load
        if (sessionIds.current.size > 0) {
          console.log('[ItemBatchEditor] Refresh - reloading from sessionIds');
          
          // Get all items from cache (force refresh to get latest from Redis)
          const allItems = await getItems(true);
          
          // Create a map of ID -> item for quick lookup
          const itemMap = new Map(allItems.map(item => [item.id, item]));
          
          // Preserve current row order by iterating through existing rows
          // and updating with fresh data from cache
          const newRows: SpreadsheetRow[] = [];
          
          for (const currentRow of rowsRef.current) {
            if (currentRow.isDraft) {
              // Keep draft rows as-is (only if preserveDrafts is true)
              if (preserveDrafts) {
                newRows.push(currentRow);
              }
            } else if (typeof currentRow.id === 'number' && sessionIds.current.has(currentRow.id)) {
              // Row is in our session - update with fresh data
              const freshItem = itemMap.get(currentRow.id);
              if (freshItem) {
                newRows.push(itemToRow(freshItem));
              }
            }
          }
          
          console.log('[ItemBatchEditor] Preserved order with', newRows.length, 'rows');
          
          // Initialize spreadsheet with refreshed data
          dispatch(initializeSpreadsheet({
            modelName: 'Item',
            rows: newRows,
          }));
        } else if (isEmptyMode.current) {
          // Empty mode refresh: Just keep existing rows
          console.log('[ItemBatchEditor] Empty mode refresh - keeping existing rows');
        } else {
          // No config and no sessionIds
          console.error('[ItemBatchEditor] No config and no sessionIds');
          dispatch(setError('No items selected for batch editing'));
          return;
        }
      }
      
    } catch (err) {
      console.error('[ItemBatchEditor] Load error:', err);
      dispatch(setError(err instanceof Error ? err.message : 'Failed to load items'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, getItems]);
  
  /**
   * Initial data load and cleanup on unmount
   */
  useEffect(() => {
    if (!initialLoadDone.current) {
      loadItems();
    }
    
    // Cleanup on unmount - reset spreadsheet state
    // NOTE: We do NOT remove sessionStorage config here because:
    // 1. Browser refresh (F5) should preserve the session
    // 2. Navigation away will naturally make the config stale (it's page-specific)
    // 3. Config is cleaned up when ItemsList creates a new session
    return () => {
      dispatch(resetSpreadsheet());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount
  
  /**
   * Validate a single field (async)
   */
  const validateField = useCallback(async (
    rowId: string | number,
    fieldName: string,
    newValue: any,
    originalValue: any
  ) => {
    try {
      // Skip validation for multiselect and collaborator_roles fields (validated client-side)
      const column = ITEM_COLUMNS.find(col => col.fieldName === fieldName);
      if (column?.cellType === 'multiselect' || column?.cellType === 'collaborator_roles') {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            validationState: 'valid',
            validationError: undefined,
          },
        }));
        return;
      }
      
      // Special validation for catalog_number (unique field)
      if (fieldName === 'catalog_number') {
        const valueStr = String(newValue || '').trim();
        
        if (valueStr === '') {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: 'invalid',
              validationError: 'Catalog Number is required',
            },
          }));
          return;
        }
        
        // Check uniqueness across:
        // 1. Current spreadsheet rows (including unsaved drafts)
        // 2. Backend database (cached items)
        
        // First check: Is this the row's original value?
        const currentRow = rowsRef.current.find(r => r.id === rowId);
        const originalCatalogNumber = currentRow?.cells['catalog_number']?.originalValue;
        const isOriginalValue = valueStr === originalCatalogNumber;
        
        if (isOriginalValue) {
          // Reverting to original value is always valid
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: 'valid',
              validationError: undefined,
            },
          }));
          return;
        }
        
        // Second check: Does any OTHER row in the spreadsheet have this value?
        const duplicateInSpreadsheet = rowsRef.current.some(row => {
          if (row.id === rowId) return false; // Skip current row
          const cellValue = row.cells['catalog_number']?.value;
          return String(cellValue || '').trim() === valueStr;
        });
        
        if (duplicateInSpreadsheet) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: 'invalid',
              validationError: 'This catalog number is already used in another row',
            },
          }));
          return;
        }
        
        // Third check: Does this exist in the backend cache (excluding current item)?
        const cachedItems = await getItems();
        const duplicateInBackend = cachedItems.some((item: Item) => {
          if (item.id === rowId) return false; // Skip current item
          return item.catalog_number === valueStr;
        });
        
        if (duplicateInBackend) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              validationState: 'invalid',
              validationError: 'This catalog number already exists in the database',
            },
          }));
          return;
        }
        
        // All checks passed - value is unique
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            validationState: 'valid',
            validationError: undefined,
          },
        }));
        return;
      }
      
      // For now, mark all other fields as valid
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          validationState: 'valid',
          validationError: undefined,
        },
      }));
      
    } catch (error) {
      console.error('[ItemBatchEditor] Validation error:', error);
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          validationState: 'invalid',
          validationError: error instanceof Error ? error.message : 'Validation failed',
        },
      }));
    }
  }, [dispatch, getItems]);
  
  /**
   * Handle cell change from the spreadsheet grid
   */
  const handleCellChange = useCallback((
    rowId: string | number,
    fieldName: string,
    newValue: any,
    text?: string
  ) => {
    if (fieldName === 'collaborators') {
      console.log('[ItemBatchEditor] handleCellChange params:');
      console.log('  rowId:', rowId);
      console.log('  fieldName:', fieldName);
      console.log('  newValue:', newValue);
      console.log('  text param:', text);
      console.log('  text type:', typeof text);
    }
    
    // Use text or fallback to empty string
    let newText = text || '';
    
    // Get row and original value
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    
    const originalValue = row.cells[fieldName]?.originalValue;
    const isDraftRow = row.isDraft === true;
    const rowHasAnyChanges = row.hasChanges === true;
    
    // Get column metadata
    const column = ITEM_COLUMNS.find(col => col.fieldName === fieldName);
    
    // Check required fields (only for draft rows with changes)
    if (column?.required && isDraftRow && rowHasAnyChanges) {
      const isEmpty = newValue === null || newValue === undefined || newValue === '' || 
                      (Array.isArray(newValue) && newValue.length === 0);
      
      if (isEmpty) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: newValue,
            text: newText,
            validationState: 'invalid',
            validationError: `${column.header} is required.`,
            hasConflict: false,
          },
        }));
        return;
      }
    }
    
    // Special handling for title fields (ItemTitle management)
    if (fieldName === 'primary_title' || fieldName === 'secondary_title') {
      // Empty values are valid (user clearing the field)
      if (newValue === null || newValue === undefined || newValue === '') {
        // Field is being cleared - this is valid
        // Continue to general validation logic which will handle it properly
      } else if (typeof newValue === 'string' && newValue.trim() !== '') {
        // If it's a non-empty string, it means plain text was pasted (not from our serialization)
        // Mark as invalid - user must use the custom editor or copy from another title cell
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newValue,
            validationState: 'invalid',
            validationError: 'Cannot paste title as plain text. Please copy from another title cell or use the cell editor.',
            hasConflict: false,
          },
        }));
        return;
      } else if (typeof newValue === 'object') {
        // Validate structure: must have 'title' property (string), optional 'language' (object with id)
        const titleData = newValue as any;
        
        if (!titleData.title || typeof titleData.title !== 'string') {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: null,
              text: newText,
              validationState: 'invalid',
              validationError: 'Invalid title format: missing title text.',
              hasConflict: false,
            },
          }));
          return;
        }
        
        // If language is provided, validate it has an ID
        if (titleData.language !== null && titleData.language !== undefined) {
          if (typeof titleData.language !== 'object' || !titleData.language.id) {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                value: null,
                text: newText,
                validationState: 'invalid',
                validationError: 'Invalid language format.',
                hasConflict: false,
              },
            }));
            return;
          }
        }
      } else {
        // Invalid type
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid title format.',
            hasConflict: false,
          },
        }));
        return;
      }
    }
    
    // Special handling for collaborators field (complex through model)
    if (fieldName === 'collaborators') {
      // Empty values are valid (user clearing the field)
      if (newValue === null || newValue === undefined || newValue === '' || 
          (Array.isArray(newValue) && newValue.length === 0)) {
        // Field is being cleared - this is valid
        // Continue to general validation logic which will handle it properly
      } else if (typeof newValue === 'string' && newValue.trim() !== '') {
        // If it's a non-empty string, it means plain text was pasted (not from our serialization)
        // Our clipboard serialization returns {value, text} for collaborator_roles type
        // Mark as invalid - user must use the custom editor or copy from another collaborators cell
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newValue,
            validationState: 'invalid',
            validationError: 'Cannot paste collaborators as plain text. Please copy from another collaborators cell or use the cell editor.',
            hasConflict: false,
          },
        }));
        return;
      } else if (!Array.isArray(newValue)) {
        // Validate array structure (but not null/empty which we already handled above)
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid collaborators format.',
            hasConflict: false,
          },
        }));
        return;
      } else if (Array.isArray(newValue) && newValue.length > 0) {
        // Check if any collaborators have id: null (invalid from parser errors)
        const hasInvalidCollaborators = newValue.some((collab: any) => 
          collab && (collab.id === null || collab.id === undefined)
        );
        
        if (hasInvalidCollaborators) {
          // Extract invalid collaborator names for error message
          const invalidNames = newValue
            .filter((collab: any) => collab && (collab.id === null || collab.id === undefined))
            .map((collab: any) => collab.name)
            .join(', ');
          
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,  // Keep the value so user can see it in editor
              text: newText,
              validationState: 'invalid',
              validationError: `Invalid collaborator(s): ${invalidNames}. Not found in database.`,
              hasConflict: false,
            },
          }));
          return;
        }
        
        // Validate each collaborator object (only for valid collaborators)
        for (const collab of newValue) {
          // Must have id (and it must not be null, which we checked above)
          if (!collab.id || typeof collab.id !== 'number') {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                value: null,
                text: newText,
                validationState: 'invalid',
                validationError: 'Invalid collaborator: missing or invalid ID.',
                hasConflict: false,
              },
            }));
            return;
          }
          
          // roles must be an array
          if (!Array.isArray(collab.roles)) {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                value: null,
                text: newText,
                validationState: 'invalid',
                validationError: `Invalid roles for collaborator ${collab.name || collab.id}.`,
                hasConflict: false,
              },
            }));
            return;
          }
          
          // Validate each role value
          const validRoles = ROLE_CHOICES.map(r => r.value);
          const invalidRoles = collab.roles.filter((r: string) => !validRoles.includes(r));
          if (invalidRoles.length > 0) {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                value: null,
                text: newText,
                validationState: 'invalid',
                validationError: `Invalid role(s) for ${collab.name || collab.id}: ${invalidRoles.join(', ')}`,
                hasConflict: false,
              },
            }));
            return;
          }
          
          // citation_author must be boolean
          if (typeof collab.citation_author !== 'boolean') {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                value: null,
                text: newText,
                validationState: 'invalid',
                validationError: `Invalid citation_author for ${collab.name || collab.id}.`,
                hasConflict: false,
              },
            }));
            return;
          }
        }
      }
    }
    
    // Special handling for language field (multiselect with validation for invalid languoids)
    if (fieldName === 'language') {
      // Empty values are valid (user clearing the field)
      if (newValue === null || newValue === undefined || newValue === '' || 
          (Array.isArray(newValue) && newValue.length === 0)) {
        // Field is being cleared - this is valid
        // Continue to general validation logic which will handle it properly
      } else if (!Array.isArray(newValue)) {
        // Must be an array
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid language format: expected array.',
            hasConflict: false,
          },
        }));
        return;
      } else if (Array.isArray(newValue) && newValue.length > 0) {
        // Check if any languoids have id: null (invalid languoids from parser errors)
        const hasInvalidLanguoids = newValue.some((lang: any) => 
          lang && (lang.id === null || lang.id === undefined)
        );
        
        if (hasInvalidLanguoids) {
          // Extract invalid languoid names for error message
          const invalidNames = newValue
            .filter((lang: any) => lang && (lang.id === null || lang.id === undefined))
            .map((lang: any) => lang.glottocode ? `${lang.name} (${lang.glottocode})` : lang.name)
            .join(', ');
          
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,  // Keep the value so user can see it in editor
              text: newText,
              validationState: 'invalid',
              validationError: `Invalid languoid(s): ${invalidNames}. Not found in database.`,
              hasConflict: false,
            },
          }));
          return;
        }
        
        // Validate each languoid object structure
        for (const lang of newValue) {
          // Must have id (and it must not be null, which we checked above)
          if (!lang.id || typeof lang.id !== 'number') {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                value: null,
                text: newText,
                validationState: 'invalid',
                validationError: 'Invalid languoid: missing or invalid ID.',
                hasConflict: false,
              },
            }));
            return;
          }
        }
      }
    }
    
    // Special handling for multiselect fields
    if (column?.cellType === 'multiselect') {
      // First, try to parse text input (for paste operations)
      if (typeof newValue === 'string' && newValue.trim() !== '') {
        // Parse comma-separated text into array
        const parsedArray = newValue.split(',').map(v => v.trim()).filter(v => v.length > 0);
        
        // Try to match labels to values (case-insensitive)
        const choices = fieldName === 'genre' ? GENRE_CHOICES : 
                       fieldName === 'language_description_type' ? LANGUAGE_DESCRIPTION_TYPE_CHOICES :
                       null;
        
        if (choices) {
          // Map labels/values to actual choice values
          newValue = parsedArray.map(item => {
            const lowerItem = item.toLowerCase();
            // Try exact value match first
            const exactMatch = choices.find(c => c.value.toLowerCase() === lowerItem);
            if (exactMatch) return exactMatch.value;
            
            // Try label match
            const labelMatch = choices.find(c => c.label.toLowerCase() === lowerItem);
            if (labelMatch) return labelMatch.value;
            
            // No match - keep original (will be caught by validation)
            return item;
          });
          
          // Update display text with matched labels
          newText = newValue.map((v: string) => {
            const choice = choices.find(c => c.value === v);
            return choice ? choice.label : v;
          }).join(', ');
        } else {
          // No choices to validate against (M2M relationship field)
          newValue = parsedArray;
        }
      }
      
      // Now validate
      if (newValue === null && newText && newText.trim() !== '') {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid multiselect value. Please select from dropdown.',
            hasConflict: false,
          },
        }));
        return;
      }
      
      if (newValue !== null && !Array.isArray(newValue)) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: null,
            text: newText,
            validationState: 'invalid',
            validationError: 'Invalid multiselect value format.',
            hasConflict: false,
          },
        }));
        return;
      }
      
      // For choice-based multiselects, validate each value is in choices
      if (Array.isArray(newValue) && newValue.length > 0) {
        const choices = fieldName === 'genre' ? GENRE_CHOICES : 
                       fieldName === 'language_description_type' ? LANGUAGE_DESCRIPTION_TYPE_CHOICES :
                       null;
        
        if (choices) {
          const validValues = choices.map(c => c.value);
          const invalidValues = newValue.filter(v => !validValues.includes(v));
          
          if (invalidValues.length > 0) {
            dispatch(updateCell({
              rowId,
              fieldName,
              cell: {
                value: newValue,
                text: newText,
                validationState: 'invalid',
                validationError: `Invalid values: ${invalidValues.join(', ')}`,
                hasConflict: false,
              },
            }));
            return;
          }
        }
      }
    }
    
    // Special handling for select (choice) fields
    if (column?.cellType === 'select' && column?.choices) {
      // If value is not empty, validate it's in the choices list
      if (newValue !== null && newValue !== undefined && newValue !== '') {
        const validChoice = column.choices.some(choice => choice.value === newValue);
        if (!validChoice) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,
              text: newText,
              validationState: 'invalid',
              validationError: `Invalid choice. Must be one of the allowed values.`,
              hasConflict: false,
            },
          }));
          return;
        }
      }
    }
    
    // Special handling for boolean fields
    if (column?.cellType === 'boolean') {
      // First, try to parse text input into boolean values (for paste operations)
      if (typeof newValue === 'string') {
        const lowerText = newValue.toLowerCase().trim();
        if (lowerText === 'true' || lowerText === '1' || lowerText === 'yes') {
          newValue = true;
          newText = 'Yes';
        } else if (lowerText === 'false' || lowerText === '0' || lowerText === 'no') {
          newValue = false;
          newText = 'No';
        } else if (lowerText === '' || lowerText === 'null' || lowerText === 'not specified') {
          newValue = null;
          newText = 'Not specified';
        }
        // If string doesn't match any valid patterns, keep it as-is and validation below will catch it
      }
      
      // Now validate: Boolean fields must be true, false, or null
      if (newValue !== true && newValue !== false && newValue !== null && newValue !== undefined) {
        dispatch(updateCell({
          rowId,
          fieldName,
          cell: {
            value: newValue,
            text: newText,
            validationState: 'invalid',
            validationError: `Invalid boolean value. Must be Yes, No, or Not specified.`,
            hasConflict: false,
          },
        }));
        return;
      }
    }
    
    // Special handling for decimal fields (latitude, longitude)
    if (column?.cellType === 'decimal') {
      // Validate decimal format (empty string is valid for nullable fields)
      if (newValue !== '' && newValue !== null && newValue !== undefined) {
        const valueStr = String(newValue);
        const decimalRegex = /^-?\d+\.?\d*$|^-?\d*\.\d+$/;
        
        // Check basic format
        if (!decimalRegex.test(valueStr)) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,
              text: newText,
              validationState: 'invalid',
              validationError: 'Invalid decimal format. Use numbers like: 42, -17.5, 122.419906',
              hasConflict: false,
            },
          }));
          return;
        }
        
        // Check decimal places limit (max 16 decimal places for lat/long fields)
        const decimalPart = valueStr.split('.')[1];
        if (decimalPart && decimalPart.length > 16) {
          dispatch(updateCell({
            rowId,
            fieldName,
            cell: {
              value: newValue,
              text: newText,
              validationState: 'invalid',
              validationError: 'Too many decimal places. Maximum 16 decimal places allowed.',
              hasConflict: false,
            },
          }));
          return;
        }
      }
    }
    
    // Short-circuit: If value equals DB value, it's automatically valid
    let valuesAreEqual = false;
    
    if (Array.isArray(newValue) && Array.isArray(originalValue)) {
      // Compare arrays (for M2M fields)
      const sortedNew = [...newValue].sort((a: number, b: number) => a - b);
      const sortedOrig = [...originalValue].sort((a: number, b: number) => a - b);
      valuesAreEqual = JSON.stringify(sortedNew) === JSON.stringify(sortedOrig);
    } else {
      valuesAreEqual = newValue === originalValue;
    }
    
    if (valuesAreEqual) {
      dispatch(updateCell({
        rowId,
        fieldName,
        cell: {
          value: newValue,
          text: newText,
          validationState: 'valid',
          validationError: undefined,
          hasConflict: false,
        },
      }));
      return;
    }
    
    // Value differs from DB - update cell and trigger validation
    if (fieldName === 'collaborators') {
      console.log('[ItemBatchEditor] Dispatching updateCell for collaborators');
      console.log('[ItemBatchEditor] newValue:', newValue);
      console.log('[ItemBatchEditor] newText:', newText);
    }
    
    dispatch(updateCell({
      rowId,
      fieldName,
      cell: {
        value: newValue,
        text: newText,
        hasConflict: false,
      },
    }));
    
    // Trigger backend validation
    validateField(rowId, fieldName, newValue, originalValue);
  }, [rows, dispatch, validateField]);
  
  /**
   * Handle batch cell changes (paste operations)
   * Applies parsing and validation logic for multiple cells at once
   */
  const handleBatchCellChange = useCallback((
    changes: Array<{ rowId: string | number; fieldName: string; newValue: any; newText?: string }>,
    description: string
  ) => {
    // Transform changes to Redux format with parsing and validation
    const reduxChanges = changes.map(({ rowId, fieldName, newValue, newText }) => {
      const text = newText ?? (typeof newValue === 'string' ? newValue : String(newValue || ''));
      const column = ITEM_COLUMNS.find(col => col.fieldName === fieldName);
      
      // Start with valid state
      let cell: Partial<SpreadsheetCell> = {
        value: newValue,
        text: text,
        validationState: 'valid' as const,
      };
      
      // Multiselect field parsing and validation
      if (column?.cellType === 'multiselect') {
        // First, try to parse text input (for paste operations)
        if (typeof cell.value === 'string' && cell.value.trim() !== '') {
          // Parse comma-separated text into array
          const parsedArray = cell.value.split(',').map(v => v.trim()).filter(v => v.length > 0);
          
          // Try to match labels to values (case-insensitive)
          const choices = fieldName === 'genre' ? GENRE_CHOICES : 
                         fieldName === 'language_description_type' ? LANGUAGE_DESCRIPTION_TYPE_CHOICES :
                         null;
          
          if (choices) {
            // Map labels/values to actual choice values
            cell.value = parsedArray.map(item => {
              const lowerItem = item.toLowerCase();
              // Try exact value match first
              const exactMatch = choices.find(c => c.value.toLowerCase() === lowerItem);
              if (exactMatch) return exactMatch.value;
              
              // Try label match
              const labelMatch = choices.find(c => c.label.toLowerCase() === lowerItem);
              if (labelMatch) return labelMatch.value;
              
              // No match - keep original (will be caught by validation)
              return item;
            });
            
            // Update display text with matched labels
            cell.text = cell.value.map((v: string) => {
              const choice = choices.find(c => c.value === v);
              return choice ? choice.label : v;
            }).join(', ');
          } else {
            // No choices to validate against (M2M relationship field)
            cell.value = parsedArray;
          }
        }
        
        // Now validate
        if (cell.value === null && text && text.trim() !== '') {
          cell.validationState = 'invalid';
          cell.validationError = 'Invalid multiselect value. Please select from dropdown.';
        } else if (cell.value !== null && !Array.isArray(cell.value)) {
          cell = {
            value: null,
            text: text,
            validationState: 'invalid',
            validationError: 'Invalid multiselect value format.',
          };
        } else if (Array.isArray(cell.value) && cell.value.length > 0) {
          // For choice-based multiselects, validate each value is in choices
          const choices = fieldName === 'genre' ? GENRE_CHOICES : 
                         fieldName === 'language_description_type' ? LANGUAGE_DESCRIPTION_TYPE_CHOICES :
                         null;
          
          if (choices) {
            const validValues = choices.map(c => c.value);
            const invalidValues = cell.value.filter(v => !validValues.includes(v));
            
            if (invalidValues.length > 0) {
              cell.validationState = 'invalid';
              cell.validationError = `Invalid values: ${invalidValues.join(', ')}`;
            }
          }
        }
      }
      
      // Boolean field parsing (for paste operations)
      if (column?.cellType === 'boolean') {
        // Try to parse text input into boolean values
        if (typeof cell.value === 'string') {
          const lowerText = cell.value.toLowerCase().trim();
          if (lowerText === 'true' || lowerText === '1' || lowerText === 'yes') {
            cell.value = true;
            cell.text = 'Yes';
          } else if (lowerText === 'false' || lowerText === '0' || lowerText === 'no') {
            cell.value = false;
            cell.text = 'No';
          } else if (lowerText === '' || lowerText === 'null' || lowerText === 'not specified') {
            cell.value = null;
            cell.text = 'Not specified';
          }
          // If string doesn't match any valid patterns, keep as-is and validation will happen on backend
        }
        
        // Validate: Boolean fields must be true, false, or null
        if (cell.value !== true && cell.value !== false && cell.value !== null && cell.value !== undefined) {
          cell.validationState = 'invalid';
          cell.validationError = 'Invalid boolean value. Must be Yes, No, or Not specified.';
        }
      }
      
      // Decimal field validation (latitude, longitude)
      if (column?.cellType === 'decimal') {
        // Validate decimal format (empty string is valid for nullable fields)
        if (cell.value !== '' && cell.value !== null && cell.value !== undefined) {
          const valueStr = String(cell.value);
          const decimalRegex = /^-?\d+\.?\d*$|^-?\d*\.\d+$/;
          
          // Check basic format
          if (!decimalRegex.test(valueStr)) {
            cell.validationState = 'invalid';
            cell.validationError = 'Invalid decimal format. Use numbers like: 42, -17.5, 122.419906';
          } else {
            // Check decimal places limit (max 16 decimal places for lat/long fields)
            const decimalPart = valueStr.split('.')[1];
            if (decimalPart && decimalPart.length > 16) {
              cell.validationState = 'invalid';
              cell.validationError = 'Too many decimal places. Maximum 16 decimal places allowed.';
            }
          }
        }
      }
      
      // Select (choice) field validation
      if (column?.cellType === 'select' && column?.choices) {
        // If value is not empty, validate it's in the choices list
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          const validChoice = column.choices.some(choice => choice.value === cell.value);
          if (!validChoice) {
            cell.validationState = 'invalid';
            cell.validationError = 'Invalid choice. Must be one of the allowed values.';
          }
        }
      }
      
      return { rowId, fieldName, cell };
    });
    
    // Dispatch batch update
    dispatch(batchUpdateCells({ changes: reduxChanges, description }));
    
    // Trigger backend validation for all changed cells (unless already invalid from client-side validation)
    changes.forEach(({ rowId, fieldName, newValue }) => {
      const row = rows.find(r => r.id === rowId);
      const originalValue = row?.cells[fieldName]?.originalValue;
      
      // Only validate if the cell isn't already marked as invalid by client-side validation
      const reduxChange = reduxChanges.find(rc => rc.rowId === rowId && rc.fieldName === fieldName);
      if (reduxChange?.cell.validationState !== 'invalid') {
        validateField(rowId, fieldName, newValue, originalValue);
      }
    });
  }, [rows, dispatch, validateField]);
  
  /**
   * Handle adding a new draft row
   */
  const handleAddRow = useCallback(async () => {
    const newRow = await createDraftRow(rows);
    dispatch(addDraftRow(newRow));
    
    // Trigger scroll to the new row
    setScrollToRowId(newRow.id);
    setTimeout(() => setScrollToRowId(null), 500);
  }, [dispatch, rows]);
  
  /**
   * Handle refresh confirm - actually performs the refresh from database
   */
  const handleRefreshConfirm = useCallback(async () => {
    setShowRefreshConfirm(false);
    
    // Clear undo/redo history and selections before reloading
    dispatch(clearHistory());
    dispatch(clearAllSelections());
    
    try {
      // Set loading state FIRST and give React time to render it
      dispatch(setLoading(true));
      
      // Small delay to ensure loading overlay is visible before starting work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if we have sessionIds
      if (sessionIds.current.size === 0 && !isEmptyMode.current) {
        dispatch(setError('No items selected for batch editing'));
        dispatch(setLoading(false));
        return;
      }
      
      console.log('[ItemBatchEditor] Refreshing items from cache...');
      console.log('[ItemBatchEditor] Current sessionIds:', Array.from(sessionIds.current));
      
      // Force refresh from Redis cache to get latest data (bypass in-memory cache)
      const freshItems = await getItems(true);
      console.log('[ItemBatchEditor] Got', freshItems.length, 'items from cache');
      
      // Create a map of ID -> item for quick lookup
      const itemMap = new Map(freshItems.map(item => [item.id, item]));
      
      // Preserve current row order by iterating through existing rows
      // and updating with fresh data from cache
      const newRows: SpreadsheetRow[] = [];
      
      for (const currentRow of rowsRef.current) {
        if (currentRow.isDraft) {
          // Discard draft rows on manual refresh (user confirmation to discard)
          continue;
        } else if (typeof currentRow.id === 'number' && sessionIds.current.has(currentRow.id)) {
          // Row is in our session - update with fresh data
          const freshItem = itemMap.get(currentRow.id);
          if (freshItem) {
            newRows.push(itemToRow(freshItem));
          }
        }
        // Skip rows not in sessionIds (shouldn't happen)
      }
      
      console.log('[ItemBatchEditor] Preserved order with', newRows.length, 'rows');
      
      // Initialize spreadsheet with fresh data (order preserved)
      dispatch(initializeSpreadsheet({
        modelName: 'Item',
        rows: newRows,
      }));
      
      dispatch(setLoading(false));
      
    } catch (err) {
      console.error('[ItemBatchEditor] Refresh error:', err);
      dispatch(setError(err instanceof Error ? err.message : 'Failed to refresh'));
      dispatch(setLoading(false));
    }
  }, [dispatch, getItems]);
  
  /**
   * Handle refresh (reload data from database)
   */
  const handleRefresh = useCallback(() => {
    if (anyChanges) {
      setShowRefreshConfirm(true);
    } else {
      handleRefreshConfirm();
    }
  }, [anyChanges, handleRefreshConfirm]);
  
  /**
   * Handle save (respects row selection)
   */
  const handleSaveAll = useCallback(() => {
    const selectedRows = rows.filter(row => row.isSelected);
    const changedRows = rows.filter(row => row.hasChanges);
    
    if (selectedRows.length === 0) {
      if (changedRows.length === 0) {
        setSnackbarMessage('No changes to save');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
        return;
      }
      
      setShowSaveAllConfirm(true);
      return;
    }
    
    const editedRows = selectedRows.filter(row => row.hasChanges);
    
    if (editedRows.length === 0) {
      setSnackbarMessage('Selected rows have no changes to save');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
      return;
    }
    
    // Check for validation errors
    const rowsWithErrors = editedRows.filter(row => row.hasErrors);
    if (rowsWithErrors.length > 0) {
      const errorInfo = rowsWithErrors.map((row) => {
        const rowNumber = rows.indexOf(row) + 1;
        const name = row.cells.catalog_number?.text || `Row ${rowNumber}`;
        const errors = Object.values(row.cells)
          .filter(cell => cell.validationState === 'invalid')
          .map(cell => cell.validationError || 'Unknown error');
        return { rowNumber, name, errors };
      });
      setValidationErrorRows(errorInfo);
      setShowValidationErrors(true);
      return;
    }
    
    handleSaveAllConfirm();
  }, [rows]);
  
  const handleSaveAllConfirm = useCallback(async () => {
    setShowSaveAllConfirm(false);
    
    const selectedRows = rows.filter(row => row.isSelected);
    let editedRows: typeof rows;
    
    if (selectedRows.length === 0) {
      editedRows = rows.filter(row => row.hasChanges && !row.hasErrors);
      
      const changedRows = rows.filter(row => row.hasChanges);
      const rowsWithErrors = changedRows.filter(row => row.hasErrors);
      if (rowsWithErrors.length > 0) {
        const errorInfo = rowsWithErrors.map((row) => {
          const rowNumber = rows.indexOf(row) + 1;
          const name = row.cells.catalog_number?.text || `Row ${rowNumber}`;
          const errors = Object.values(row.cells)
            .filter(cell => cell.validationState === 'invalid')
            .map(cell => cell.validationError || 'Unknown error');
          return { rowNumber, name, errors };
        });
        setValidationErrorRows(errorInfo);
        setShowValidationErrors(true);
        return;
      }
    } else {
      editedRows = selectedRows.filter(row => row.hasChanges && !row.hasErrors);
    }
    
    try {
      dispatch(setSaving(true));
      
      // Convert SpreadsheetRows to API format
      const rowsToSave = editedRows.map(row => {
        const rowData: any = { id: row.id };
        
        // Include timestamp for conflict detection (existing rows only)
        if (!row.isDraft && (row as any)._updated) {
          rowData._updated = (row as any)._updated;
        }
        
        if (row.isDraft) {
          // NEW ROWS: Send all non-empty values
          ITEM_COLUMNS.forEach(col => {
            const cell = row.cells[col.fieldName];
            if (cell) {
              let cellValue = cell.value;
              
              // For M2M language field, convert from {id, name}[] to just IDs
              if (col.fieldName === 'language' && Array.isArray(cellValue)) {
                cellValue = cellValue
                  .filter((item: any) => {
                    // Filter out invalid languoids (id: null from parser errors)
                    if (typeof item === 'object' && item !== null) {
                      return item.id !== null && item.id !== undefined;
                    }
                    return item !== null && item !== undefined;
                  })
                  .map((item: any) => {
                    // Handle both object format {id, name, glottocode} and plain ID
                    if (typeof item === 'object' && item !== null) {
                      // Convert string IDs to numbers
                      return typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
                    }
                    // Plain ID - convert to number if string
                    return typeof item === 'string' ? parseInt(item, 10) : item;
                  });
              }
              
              // For collaborators field, strip out name field (backend only needs id, roles, citation_author)
              if (col.fieldName === 'collaborators' && Array.isArray(cellValue)) {
                cellValue = cellValue.map((collab: any) => ({
                  id: collab.id,
                  roles: collab.roles || [],
                  citation_author: collab.citation_author || false
                }));
              }
              
              // For title fields (primary_title, secondary_title), send structured data
              // Backend expects: { title: string, language_id: number | null }
              if ((col.fieldName === 'primary_title' || col.fieldName === 'secondary_title') && cellValue) {
                if (typeof cellValue === 'object' && cellValue.title) {
                  cellValue = {
                    title: cellValue.title,
                    language_id: cellValue.language?.id || null
                  };
                }
                // If cellValue is null or empty, backend will delete the ItemTitle
              }
              
              // Include all fields with non-empty values
              if (cellValue !== null && cellValue !== '' && cellValue !== undefined) {
                rowData[col.fieldName] = cellValue;
              } else if (Array.isArray(cellValue)) {
                rowData[col.fieldName] = cellValue;
              }
            }
          });
        } else {
          // EXISTING ROWS: Only send CHANGED fields
          const originalValues: any = {};
          
          ITEM_COLUMNS.forEach(col => {
            const cell = row.cells[col.fieldName];
            if (cell && cell.isEdited) {
              let cellValue = cell.value;
              
              // For M2M language field, convert from {id, name}[] to just IDs
              if (col.fieldName === 'language' && Array.isArray(cellValue)) {
                cellValue = cellValue
                  .filter((item: any) => {
                    // Filter out invalid languoids (id: null from parser errors)
                    if (typeof item === 'object' && item !== null) {
                      return item.id !== null && item.id !== undefined;
                    }
                    return item !== null && item !== undefined;
                  })
                  .map((item: any) => {
                    // Handle both object format {id, name, glottocode} and plain ID
                    if (typeof item === 'object' && item !== null) {
                      // Convert string IDs to numbers
                      return typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
                    }
                    // Plain ID - convert to number if string
                    return typeof item === 'string' ? parseInt(item, 10) : item;
                  });
              }
              
              // For collaborators field, strip out name field (backend only needs id, roles, citation_author)
              if (col.fieldName === 'collaborators' && Array.isArray(cellValue)) {
                cellValue = cellValue.map((collab: any) => ({
                  id: collab.id,
                  roles: collab.roles || [],
                  citation_author: collab.citation_author || false
                }));
              }
              
              // For title fields (primary_title, secondary_title), send structured data
              // Backend expects: { title: string, language_id: number | null }
              if ((col.fieldName === 'primary_title' || col.fieldName === 'secondary_title') && cellValue) {
                if (typeof cellValue === 'object' && cellValue.title) {
                  cellValue = {
                    title: cellValue.title,
                    language_id: cellValue.language?.id || null
                  };
                }
                // If cellValue is null or empty, backend will delete the ItemTitle
              }
              
              rowData[col.fieldName] = cellValue ?? '';
              originalValues[col.fieldName] = cell.originalValue;
            }
          });
          
          // Include original values for conflict detection
          if (Object.keys(originalValues).length > 0) {
            rowData._original_values = originalValues;
          }
        }
        
        return rowData;
      });
      
      // Call save-batch API
      const response = await itemsAPI.saveBatch(rowsToSave);
      
      if (response.success) {
        // Handle conflicts
        const conflicts = response.errors?.filter((err: any) => err.type === 'conflict') || [];
        const conflictRowIds = new Set<number>();
        
        if (conflicts.length > 0) {
          // Handle conflicts similar to CollaboratorBatchEditor
          conflicts.forEach((conflict: any) => {
            const rowId = conflict.row_id;
            conflictRowIds.add(rowId);
            const currentData = conflict.current_data;
            const conflictingFields = conflict.conflicting_fields || [];
            
            if (currentData) {
              const updatedRow = itemToRow(currentData);
              const originalRow = editedRows.find(r => r.id === rowId);
              if (originalRow) {
                let hasAnyEdits = false;
                
                Object.keys(originalRow.cells).forEach(fieldName => {
                  const cell = originalRow.cells[fieldName];
                  const hasFieldConflict = conflictingFields.includes(fieldName);
                  
                  if (cell.isEdited && hasFieldConflict) {
                    updatedRow.cells[fieldName].hasConflict = true;
                    updatedRow.cells[fieldName].isEdited = true;
                    updatedRow.cells[fieldName].value = cell.value;
                    updatedRow.cells[fieldName].text = cell.text;
                    hasAnyEdits = true;
                  } else if (cell.isEdited && !hasFieldConflict) {
                    updatedRow.cells[fieldName].isEdited = false;
                    updatedRow.cells[fieldName].value = cell.value;
                    updatedRow.cells[fieldName].text = cell.text;
                    updatedRow.cells[fieldName].originalValue = cell.value;
                  }
                });
                
                if (hasAnyEdits) {
                  updatedRow.hasChanges = true;
                }
              }
              
              const currentRows = [...rowsRef.current];
              const rowIndex = currentRows.findIndex(r => r.id === rowId);
              if (rowIndex !== -1) {
                currentRows[rowIndex] = updatedRow;
                dispatch(initializeSpreadsheet({ modelName: 'item', rows: currentRows }));
              }
            }
          });
          
          const totalConflictingFields = conflicts.reduce((sum: number, c: any) => {
            return sum + (c.conflicting_fields?.length || 0);
          }, 0);
          
          dispatch(setError(
            `${conflicts.length} row(s) were modified by another user. ` +
            `${totalConflictingFields} field(s) have conflicts and were NOT saved (highlighted in orange). ` +
            `Please review and click Save again to overwrite.`
          ));
        }
        
        // Update successfully saved rows
        let savedIndex = 0;
        for (let i = 0; i < editedRows.length; i++) {
          const oldRow = editedRows[i];
          
          const wasSaved = response.saved.some((saved: Item) => {
            if (oldRow.isDraft) {
              return saved.catalog_number === oldRow.cells.catalog_number?.value;
            } else {
              return saved.id === oldRow.id;
            }
          });
          
          if (!wasSaved) continue;
          
          const savedItem = response.saved[savedIndex];
          savedIndex++;
          
          if (conflictRowIds.has(savedItem.id)) continue;
          
          const newRow = itemToRow(savedItem);
          
          // If this was a draft, add its ID to sessionIds
          if (oldRow.isDraft && typeof newRow.id === 'number') {
            sessionIds.current.add(newRow.id);
            
            // Also update the config in sessionStorage so the new ID persists across browser refresh
            const configStr = sessionStorage.getItem('item-batch-config');
            if (configStr) {
              const config = JSON.parse(configStr);
              if (config.ids && Array.isArray(config.ids)) {
                config.ids.push(newRow.id);
                sessionStorage.setItem('item-batch-config', JSON.stringify(config));
                console.log('[ItemBatchEditor] Added new row ID to sessionStorage config:', newRow.id);
              }
            }
          }
          
          dispatch(updateRowAfterSave({ oldId: oldRow.id, newRow }));
        }
        
        if (conflicts.length === 0) {
          dispatch(setSuccessMessage(`Successfully saved ${response.saved.length} item(s)`));
          setSnackbarMessage(`Successfully saved ${response.saved.length} item(s)`);
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
          
          dispatch(clearHistory());
          dispatch(clearAllSelections());
        } else {
          dispatch(setSuccessMessage(
            `Successfully saved ${response.saved.length} item(s). ` +
            `${conflicts.length} row(s) had conflicts.`
          ));
        }
      } else {
        dispatch(setError(`Save failed: ${response.errors.join(', ')}`));
      }
      
    } catch (err) {
      console.error('[ItemBatchEditor] Save all error:', err);
      dispatch(setError(err instanceof Error ? err.message : 'Save failed'));
    } finally {
      dispatch(setSaving(false));
    }
  }, [rows, dispatch]);
  
  /**
   * Handle undo
   */
  const handleUndo = useCallback(() => {
    dispatch(undo());
  }, [dispatch]);
  
  /**
   * Handle redo
   */
  const handleRedo = useCallback(() => {
    dispatch(redo());
  }, [dispatch]);
  
  /**
   * Close snackbar
   */
  const handleSnackbarClose = useCallback(() => {
    setSnackbarOpen(false);
  }, []);
  
  /**
   * Row selection handlers
   */
  const lastClickedRowRef = useRef<string | number | null>(null);
  
  const handleToggleRowSelection = useCallback((rowId: string | number, shiftKey: boolean) => {
    if (shiftKey && lastClickedRowRef.current !== null) {
      dispatch(selectRowRange({ startId: lastClickedRowRef.current, endId: rowId }));
    } else {
      dispatch(toggleRowSelection(rowId));
      lastClickedRowRef.current = rowId;
    }
  }, [dispatch]);
  
  const handleToggleAllSelection = useCallback(() => {
    dispatch(toggleAllRowSelection());
  }, [dispatch]);
  
  return (
    <Box 
      sx={{ 
        height: 'calc(100vh - 64px)', 
        p: 2,
      }}
    >
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(setError(null))}>
          {error}
        </Alert>
      )}
      
      {/* Main Spreadsheet Grid */}
      {loading && !initialLoadDone.current ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      ) : (
        <AdaptiveSpreadsheetGrid
          modelName="Items"
          rows={rows}
          columns={columnsWithMetadata}
          loading={loading}
          saving={saving}
          onCellChange={handleCellChange}
          onBatchCellChange={handleBatchCellChange}
          onToggleRowSelection={handleToggleRowSelection}
          onToggleAllSelection={handleToggleAllSelection}
          onAddRow={handleAddRow}
          onSave={handleSaveAll}
          onRefresh={handleRefresh}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          importHook={itemImportHook}
          scrollToRowId={scrollToRowId}
        />
      )}
      
      {/* Refresh Confirmation Dialog */}
      <Dialog 
        open={showRefreshConfirm} 
        onClose={() => setShowRefreshConfirm(false)}
        aria-labelledby="refresh-dialog-title"
        aria-describedby="refresh-dialog-description"
      >
        <DialogTitle id="refresh-dialog-title">Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText id="refresh-dialog-description">
            You have unsaved changes. Refreshing will discard all changes. Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRefreshConfirm(false)}>Cancel</Button>
          <Button onClick={handleRefreshConfirm} color="error" autoFocus>
            Discard & Refresh
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Save All Confirmation Dialog */}
      <Dialog 
        open={showSaveAllConfirm} 
        onClose={() => setShowSaveAllConfirm(false)}
        aria-labelledby="save-all-dialog-title"
        aria-describedby="save-all-dialog-description"
      >
        <DialogTitle id="save-all-dialog-title">Save All Changed Rows?</DialogTitle>
        <DialogContent>
          <DialogContentText id="save-all-dialog-description">
            No rows are currently selected. Do you want to save all {rows.filter(r => r.hasChanges).length} changed row(s)?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveAllConfirm(false)}>Cancel</Button>
          <Button onClick={handleSaveAllConfirm} color="primary" autoFocus>
            Save All
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Validation Error Dialog */}
      <Dialog 
        open={showValidationErrors} 
        onClose={() => setShowValidationErrors(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="validation-errors-dialog-title"
        aria-describedby="validation-errors-dialog-description"
      >
        <DialogTitle id="validation-errors-dialog-title">Validation Errors</DialogTitle>
        <DialogContent>
          <DialogContentText id="validation-errors-dialog-description" sx={{ mb: 2 }}>
            The following rows have validation errors. Please fix them before saving:
          </DialogContentText>
          <List>
            {validationErrorRows.map((errorRow) => (
              <ListItem key={errorRow.rowNumber} sx={{ display: 'block' }}>
                <ListItemText
                  primary={`Row ${errorRow.rowNumber}: ${errorRow.name}`}
                  secondary={
                    <Box component="span">
                      {errorRow.errors.map((error, idx) => (
                        <Typography key={idx} variant="body2" color="error" component="div">
                          • {error}
                        </Typography>
                      ))}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowValidationErrors(false)} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

