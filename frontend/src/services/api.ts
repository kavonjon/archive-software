/**
 * API service layer for making authenticated requests to Django backend
 */

// Base API configuration - use relative URLs for same-origin requests (production)
// or localhost for development
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000/internal/v1'
  : '/internal/v1';

// Types for API responses
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Item {
  // Basic identifiers
  id: number;
  uuid: string;
  slug: string;
  catalog_number: string;
  
  // General section
  item_access_level: string;
  item_access_level_display: string;
  call_number: string;
  accession_date: string | null;
  accession_date_min: string | null;  // Date range fields for filtering
  accession_date_max: string | null;
  additional_digital_file_location: string;
  
  // Titles
  primary_title: string;
  titles: ItemTitle[];
  indigenous_title: string;
  english_title: string;
  
  // Content & Description
  description_scope_and_content: string;
  description: string; // Alias for backwards compatibility (maps to description_scope_and_content)
  resource_type: string;
  resource_type_display: string;
  genre: string[];
  genre_display: string[];
  language_description_type: string[];
  language_description_type_display: string[];
  browse_categories: string[];
  browse_categories_display: string[];
  language_names: string[];  // DEPRECATED - use language instead
  language: Languoid[];  // Full Languoid objects for editing
  collaborator_names: string[];  // DEPRECATED - use collaborators instead
  collaborators: Array<{
    id: number;
    name: string;
    roles: string[];
    citation_author: boolean;
  }>;  // Full collaborator objects with roles
  creation_date: string | null;
  creation_date_min: string | null;  // Date range fields for filtering
  creation_date_max: string | null;
  associated_ephemera: string;
  access_level_restrictions: string;
  copyrighted_notes: string;
  permission_to_publish_online: boolean | null;
  permission_to_publish_online_display: string;
  
  // Availability & Condition
  availability_status: string;
  availability_status_display: string;
  availability_status_notes: string;
  condition: string;
  condition_display: string;
  condition_notes: string;
  ipm_issues: string;
  conservation_treatments_performed: string;
  conservation_recommendation: string;
  
  // Accessions section
  accession_number: string;
  type_of_accession: string;
  type_of_accession_display: string;
  acquisition_notes: string;
  project_grant: string;
  collection: number | null;
  collection_name: string;
  collection_abbr: string;
  collector_name: string;
  collector_info: string;
  collectors_number: string;
  collection_date: string;
  collection_date_min: string | null;  // Date range fields for filtering
  collection_date_max: string | null;
  collecting_notes: string;
  depositor_name: string;
  depositor_contact_information: string;
  deposit_date: string;
  deposit_date_min: string | null;  // Date range fields for filtering
  deposit_date_max: string | null;
  
  // Location section
  municipality_or_township: string;
  county_or_parish: string;
  state_or_province: string;
  country_or_territory: string;
  global_region: string;
  latitude: number | null;
  longitude: number | null;
  recording_context: string;
  public_event: string;
  original_format_medium: string;
  original_format_medium_display: string;
  recorded_on: string;
  equipment_used: string;
  software_used: string;
  digital_file_location: string;
  location_of_original: string;
  other_information: string;
  
  // Books section
  publisher: string;
  publisher_address: string;
  isbn: string;
  loc_catalog_number: string;
  total_number_of_pages_and_physical_description: string;
  
  // External section
  temporary_accession_number: string;
  lender_loan_number: string;
  other_institutional_number: string;
  
  // Deprecated section
  migration_file_format: string;
  migration_location: string;
  cataloged_by: string;
  cataloged_date: string;
  filemaker_legacy_pk_id: number | null;
  
  // Migration section
  migrate: boolean;
  migrate_display: string;
  
  // Versioning section
  added: string;
  updated: string;
  modified_by: string;
  
  // Related data - collaborator kept as IDs for compatibility
  collaborator: number[];
}

// Type for creating/updating items where language can be IDs instead of full objects
export type ItemMutationData = Omit<Partial<Item>, 'language'> & {
  language?: number[] | Languoid[];
};

export interface ItemTitle {
  id?: number;  // Optional for creation
  title: string;
  language: number;  // Language ID for creation/updates
  language_name: string;  // Language name for display
  language_iso: string;   // Language ISO code for display
  default: boolean;
}

export interface CollaboratorRole {
  id: number;
  collaborator: number;  // Collaborator ID
  collaborator_data: {
    id: number;
    collaborator_id: number;
    display_name: string;
    full_name: string;
    slug: string;
  };
  role: string[];  // Array of role values (e.g., ['author', 'performer'])
  role_display: string[];  // Human-readable role labels
  citation_author: boolean;
  modified_by: string;
  updated: string;
}

// Type for creating/updating collaborator roles
export type CollaboratorRoleMutationData = {
  collaborator: number;
  role: string[];
  citation_author?: boolean;
};

export interface Collection {
  // Basic identifiers
  id: number;
  uuid: string;
  slug: string;
  
  // Core fields
  collection_abbr: string;
  name: string;
  extent: string;
  abstract: string;
  
  // Date information
  date_range_min: string | null;
  date_range_max: string | null;
  date_range: string;
  
  // Detailed information
  description: string;
  background: string;
  conventions: string;
  acquisition: string;
  access_statement: string;
  related_publications_collections: string;
  
  // Status and metadata
  expecting_additions?: boolean | null;  // Optional since API may not always return it
  expecting_additions_display?: string;
  citation_authors: string;
  
  // Multi-select fields (stored as arrays) - optional since API may not always return them
  access_levels?: string[];
  access_levels_display?: string[];
  genres?: string[];
  genres_display?: string[];
  
  // Relationships - optional since API may not always return them
  languages?: number[];  // Array of Language IDs
  language_names?: string[];  // Array of Language names for display
  
  // Computed/derived fields
  item_count?: number;  // Optional since it may not always be returned
  
  // Versioning
  added: string;
  updated: string;
  modified_by: string;
}

export interface AssociatedItem {
  id: number;
  catalog_number: string;
  primary_title: string;
  collection_abbr: string | null;
  roles: string[];
}

export interface PrivacyNotice {
  public_display: string;
  message: string;
}

export interface Collaborator {
  // Core identity fields
  id: number;
  uuid: string;
  slug: string;
  collaborator_id: number;
  full_name: string;
  first_names: string;
  last_names: string;
  name_suffix: string;
  nickname: string;
  other_names: string[]; // ArrayField - list of alternative names
  
  // Privacy and display
  anonymous: boolean | null;
  anonymous_display: string;
  display_name: string;
  privacy_notice: PrivacyNotice | null;
  
  // Cultural information
  clan_society: string;
  tribal_affiliations: string;
  origin: string;
  gender: string;
  
  // Dates (flexible text fields)
  birthdate: string;
  deathdate: string;
  
  // Additional information
  other_info: string;
  
  // Language relationships (simplified display - deprecated but kept for compatibility)
  native_language_names: string[];
  other_language_names: string[];
  
  // Language relationships (full objects for editing)
  native_languages: Languoid[];
  other_languages: Languoid[];
  
  // Related data
  associated_items: AssociatedItem[];
  
  // System metadata
  added: string;
  updated: string;
  modified_by: string;
}

export interface Languoid {
  // Basic identifiers
  id: number;
  name: string;
  name_abbrev: string;
  iso: string;
  glottocode: string;
  level_nal: string;
  level_glottolog: string;
  level_display: string;
  
  // Hierarchy - relationship fields (IDs for editing)
  family_languoid: number | null;
  pri_subgroup_languoid: number | null;
  sec_subgroup_languoid: number | null;
  parent_languoid: number | null;
  descendents: number[]; // M2M field - array of languoid IDs
  
  // Hierarchy - relationship names (for display)
  family_name: string | null;
  family_glottocode: string | null;
  parent_name: string | null;
  parent_glottocode: string | null;
  pri_subgroup_name: string | null;
  pri_subgroup_glottocode: string | null;
  sec_subgroup_name: string | null;
  sec_subgroup_glottocode: string | null;
  
  // Additional information
  alt_names: string[]; // JSONField array
  region: string;
  latitude: number | null;
  longitude: number | null;
  dialects: string;
  dialects_ids: string;
  tribes: string;
  notes: string;
  
  // Calculated fields
  child_count: number;
  dialect_count: number;
  item_count: number;
  
  // System metadata
  added: string;
  updated: string;
  modified_by: string;
}

// Tree node structure for hierarchical descendants display
export interface LanguoidTreeNode {
  id: number;
  name: string;
  glottocode: string;
  level_nal: string;
  level_display: string;
  children: LanguoidTreeNode[];
}

// Choice field options for Languoids
export const LANGUOID_LEVEL_CHOICES = [
  { value: 'family', label: 'Family' },
  { value: 'subfamily', label: 'Primary Subfamily' },
  { value: 'subsubfamily', label: 'Secondary Subfamily' },
  { value: 'language', label: 'Language' },
  { value: 'dialect', label: 'Dialect' }
];

export const LANGUOID_LEVEL_GLOTTOLOG_CHOICES = [
  { value: 'family', label: 'Family' },
  { value: 'language', label: 'Language' },
  { value: 'dialect', label: 'Dialect' }
];

// Choice field options for Collections
export const ACCESS_LEVEL_CHOICES = [
  { value: '1', label: '1 - Open Access' },
  { value: '2', label: '2 - Materials are available to view onsite but no copies may be distributed' },
  { value: '3', label: '3 - Access protected by a time limit' },
  { value: '4', label: '4 - Depositor (or someone else) controls access to the resource' },
  { value: '', label: 'Not specified' }
];

export const RESOURCE_TYPE_CHOICES = [
  { value: '3d_object', label: '3D Object' },
  { value: 'audio', label: 'Audio' },
  { value: 'audio-video', label: 'Audio/Video' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'ephemera', label: 'Ephemera' },
  { value: 'image', label: 'Image (Photograph)' },
  { value: 'manuscript', label: 'Manuscript' },
  { value: 'multimedia', label: 'Multimedia' },
  { value: 'other', label: 'Other' },
  { value: 'publication_article', label: 'Publication: Journal Article' },
  { value: 'publication_book', label: 'Publication: Book' },
  { value: 'publication_chapter', label: 'Publication: Book chapter' },
  { value: 'publication_other', label: 'Publication (other)' },
  { value: 'publication_thesis', label: 'Publication: Thesis' },
  { value: 'website', label: 'Website' },
];

export const GENRE_CHOICES = [
  { value: 'article', label: 'Article' },
  { value: 'book', label: 'Book' },
  { value: 'ceremonial', label: 'Ceremonial' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'document', label: 'Document' },
  { value: 'drama', label: 'Drama' },
  { value: 'educational', label: 'Educational material' },
  { value: 'educational_material_family', label: 'Educational materials: Family' },
  { value: 'educational_material_learners', label: 'Educational materials: For learners' },
  { value: 'educational_material_teachers', label: 'Educational materials: For teachers' },
  { value: 'educational_material_planning', label: 'Educational materials: Language planning' },
  { value: 'elicitation', label: 'Elicitation' },
  { value: 'ethnography', label: 'Ethnography' },
  { value: 'history', label: 'History' },
  { value: 'interview', label: 'Interview' },
  { value: 'music', label: 'Music' },
  { value: 'music_forty_nine', label: 'Music: 49' },
  { value: 'music_ceremonial', label: 'Music: Ceremonial' },
  { value: 'music_for_children', label: 'Music: For children' },
  { value: 'music_hand_game', label: 'Music: Hand game' },
  { value: 'music_hymn', label: 'Music: Hymn' },
  { value: 'music_native_american_church', label: 'Music: Native American Church' },
  { value: 'music_powwow', label: 'Music: Powwow' },
  { value: 'music_round_dance', label: 'Music: Round dance' },
  { value: 'music_stomp_dance', label: 'Music: Stomp dance' },
  { value: 'music_sundance', label: 'Music: Sundance' },
  { value: 'music_war_dance', label: 'Music: War dance' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'oratory', label: 'Oratory' },
  { value: 'photograph', label: 'Photograph' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'popular_production', label: 'Popular production' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'procedural', label: 'Procedural' },
  { value: 'saying_proverb', label: 'Saying or Proverb' },
  { value: 'speech_play', label: 'Speech play' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'traditional_story', label: 'Traditional story' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'translation', label: 'Translation' },
  { value: 'unintelligible', label: 'Unintelligible speech' },
  { value: '', label: 'Not specified' }
];

export const LANGUAGE_DESCRIPTION_TYPE_CHOICES = [
  { value: 'primary-text', label: 'Primary text' },
  { value: 'primary-text-igt', label: 'Primary text: IGT' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'grammar-sketch', label: 'Grammar: Sketch' },
  { value: 'grammar-specific-feature', label: 'Grammar: Specific feature' },
  { value: 'lexicon', label: 'Lexicon' },
  { value: 'lexicon-dictionary', label: 'Lexicon: Dictionary' },
  { value: 'lexicon-wordlist', label: 'Lexicon: Wordlist' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'translation', label: 'Translation' },
  { value: 'comparative', label: 'Comparative' },
  { value: 'fieldnotes', label: 'Field notes' },
  { value: 'transcribed_texts', label: 'Transcribed texts' },
];

export const ACCESSION_CHOICES = [
  { value: 'conversion', label: 'Conversion' },
  { value: 'transfer', label: 'Exchange/Transfer' },
  { value: 'field', label: 'Field Collection' },
  { value: 'found', label: 'Found in Collection/Conversion' },
  { value: 'gift', label: 'Gift' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'reproduction', label: 'Reproduction' },
];

export const AVAILABILITY_CHOICES = [
  { value: 'available', label: 'Available' },
  { value: 'restrictions', label: 'Restrictions apply' },
  { value: 'missing_parts', label: 'Missing parts' },
  { value: 'missing', label: 'Missing' },
];

export const CONDITION_CHOICES = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export const FORMAT_CHOICES = [
  { value: 'audio_cd', label: 'audio CD' },
  { value: 'audio_reel', label: 'audio reel' },
  { value: 'book', label: 'book' },
  { value: 'cassette', label: 'cassette' },
  { value: 'cd', label: 'CD' },
  { value: 'cd_dvd', label: 'CD-DVD' },
  { value: 'dat', label: 'DAT' },
  { value: 'cd_r', label: 'data CD (CD-R)' },
  { value: 'dv_r', label: 'data DVD (DV-R)' },
  { value: 'diskette', label: 'diskette' },
  { value: 'dvd', label: 'DVD' },
  { value: 'ephemera', label: 'ephemera' },
  { value: 'garment', label: 'garment' },
  { value: 'hi_8', label: 'hi-8' },
  { value: 'manuscript', label: 'manuscript' },
  { value: 'microcassette', label: 'microcassette' },
  { value: 'mini_DV', label: 'mini-DV' },
  { value: 'other', label: 'other' },
  { value: 'phonograph_record', label: 'phonograph record' },
  { value: 'reel_to_reel', label: 'reel-to-reel' },
  { value: 'vhs', label: 'VHS' },
  { value: 'video_reel', label: 'video reel' },
];

export const ROLE_CHOICES = [
  { value: 'annotator', label: 'Annotator' },
  { value: 'author', label: 'Author' },
  { value: 'collector', label: 'Collector' },
  { value: 'compiler', label: 'Compiler' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'data_inputter', label: 'Data inputter' },
  { value: 'editor', label: 'Editor' },
  { value: 'filmer', label: 'Filmer' },
  { value: 'illustrator', label: 'Illustrator' },
  { value: 'interlocutor', label: 'Interlocutor' },
  { value: 'interpreter', label: 'Interpreter' },
  { value: 'interviewer', label: 'Interviewer' },
  { value: 'performer', label: 'Performer' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'recorder', label: 'Recorder' },
  { value: 'research_participant', label: 'Research participant' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'responder', label: 'Responder' },
  { value: 'signer', label: 'Signer' },
  { value: 'speaker', label: 'Speaker' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'transcriber', label: 'Transcriber' },
  { value: 'translator', label: 'Translator' },
];

// API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Get CSRF token for authenticated requests
const getCSRFToken = async (): Promise<string> => {
  const csrfUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000/auth/csrf/'
    : '/auth/csrf/';
  const response = await fetch(csrfUrl, {
    credentials: 'include',
  });
  const data = await response.json();
  return data.csrfToken;
};

// Generic API request function with authentication
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Default headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add CSRF token for non-GET requests
  if (options.method && options.method !== 'GET') {
    const csrfToken = await getCSRFToken();
    headers['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include session cookies
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorData;
    
    try {
      errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response is not JSON, use status text
    }

    throw new APIError(errorMessage, response.status, errorData);
  }

  // For 204 No Content responses (e.g., successful DELETE), return undefined
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
};

// Items API
export const itemsAPI = {
  // Get paginated list of items with optional filtering
  // Returns full response with status for cache rebuild polling
  list: async (params?: Record<string, string | number>): Promise<PaginatedResponse<Item> & { status?: number }> => {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    const url = `${API_BASE_URL}/items/${queryString}`;
    
    // Default headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      headers,
      credentials: 'include',
    });

    // Handle 202 Accepted (cache rebuilding) - return status for polling
    if (response.status === 202) {
      const data = await response.json();
      return { ...data, status: 202, count: 0, next: null, previous: null, results: [] };
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorData;
      
      try {
        errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response is not JSON, use status text
      }

      throw new APIError(errorMessage, response.status, errorData);
    }

    const data = await response.json();
    return { ...data, status: response.status };
  },

  // Get single item by ID
  get: (id: number): Promise<Item> => {
    return apiRequest<Item>(`/items/${id}/`);
  },

  // Create new item
  create: (data: ItemMutationData): Promise<Item> => {
    return apiRequest<Item>('/items/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update existing item
  update: (id: number, data: ItemMutationData): Promise<Item> => {
    return apiRequest<Item>(`/items/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Partial update (patch) existing item
  patch: (id: number, data: ItemMutationData): Promise<Item> => {
    return apiRequest<Item>(`/items/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Delete item
  delete: (id: number): Promise<void> => {
    return apiRequest<void>(`/items/${id}/`, {
      method: 'DELETE',
    });
  },

  // Update single field (for inline editing)
  updateField: (id: number, field: string, value: any): Promise<Item> => {
    return apiRequest<Item>(`/items/${id}/update_field/`, {
      method: 'POST',
      body: JSON.stringify({ field, value }),
    });
  },

  // Batch save items (for batch editor)
  saveBatch: (rows: any[]): Promise<{ success: boolean; saved: Item[]; errors: any[] }> => {
    return apiRequest<any>('/items/save-batch/', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  // Export items to Excel
  exportItems: async (params: { mode: string; ids: number[] }): Promise<any> => {
    const url = `${API_BASE_URL}/items/export/`;
    const csrfToken = await getCSRFToken();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(errorData.detail || 'Export failed');
    }
    
    // Check Content-Type to determine if this is a file download or JSON response
    const contentType = response.headers.get('Content-Type');
    
    if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      // Synchronous export - file download
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 'items_export.xlsx';
      
      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      return { async: false, filename };
    } else {
      // Async export - JSON response with export_id
      return await response.json();
    }
  },

  // Check export status
  getExportStatus: (exportId: string): Promise<any> => {
    return apiRequest<any>(`/items/export-status/${exportId}/`);
  },

  // Download completed export
  downloadExport: async (exportId: string): Promise<Blob> => {
    const url = `${API_BASE_URL}/items/export-download/${exportId}/`;
    const csrfToken = await getCSRFToken();
    
    const response = await fetch(url, {
      headers: {
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Export download failed');
    }
    return response.blob();
  },
};

// Collections API
export const collectionsAPI = {
  // Get paginated list of collections with optional filtering
  list: (params?: Record<string, string | number>): Promise<PaginatedResponse<Collection>> => {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiRequest<PaginatedResponse<Collection>>(`/collections/${queryString}`);
  },

  // Get single collection by ID
  get: (id: number): Promise<Collection> => {
    return apiRequest<Collection>(`/collections/${id}/`);
  },

  // Create new collection
  create: (data: Partial<Collection>): Promise<Collection> => {
    return apiRequest<Collection>('/collections/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update existing collection
  update: (id: number, data: Partial<Collection>): Promise<Collection> => {
    return apiRequest<Collection>(`/collections/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Partial update (patch) existing collection
  patch: (id: number, data: Partial<Collection>): Promise<Collection> => {
    return apiRequest<Collection>(`/collections/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Delete collection
  delete: (id: number): Promise<void> => {
    return apiRequest<void>(`/collections/${id}/`, {
      method: 'DELETE',
    });
  },

  // Update single field (for inline editing)
  updateField: (id: number, field: string, value: any): Promise<Collection> => {
    return apiRequest<Collection>(`/collections/${id}/update_field/`, {
      method: 'POST',
      body: JSON.stringify({ field, value }),
    });
  },
};

// Collaborators API
export const collaboratorsAPI = {
  list: async (params?: Record<string, string | number | boolean>): Promise<PaginatedResponse<Collaborator> & { status?: number }> => {
      const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
    }
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/collaborators/${queryString ? '?' + queryString : ''}`;
    
    // Default headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      headers,
      credentials: 'include',
    });

    // Handle 202 Accepted (cache rebuilding) - return status for polling
    if (response.status === 202) {
      const data = await response.json();
      return { ...data, status: 202, count: 0, next: null, previous: null, results: [] };
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorData;
      
      try {
        errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response is not JSON, use status text
      }

      throw new APIError(errorMessage, response.status, errorData);
    }

    const data = await response.json();
    return { ...data, status: response.status };
  },

  get: (id: number | string): Promise<Collaborator> => {
    return apiRequest<Collaborator>(`/collaborators/${id}/`);
  },

  create: (data: Partial<Collaborator>): Promise<Collaborator> => {
    return apiRequest<Collaborator>('/collaborators/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: number | string, data: Partial<Collaborator>): Promise<Collaborator> => {
    return apiRequest<Collaborator>(`/collaborators/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  patch: (id: number | string, data: Partial<Collaborator>): Promise<Collaborator> => {
    return apiRequest<Collaborator>(`/collaborators/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number | string): Promise<void> => {
    return apiRequest<void>(`/collaborators/${id}/`, {
      method: 'DELETE',
    });
  },

  getNextId: (): Promise<{ next_id: number }> => {
    return apiRequest<{ next_id: number }>('/collaborators/next-id/');
  },

  saveBatch: (rows: any[]): Promise<{ success: boolean; saved: Collaborator[]; errors: any[] }> => {
    return apiRequest<{ success: boolean; saved: Collaborator[]; errors: any[] }>('/collaborators/save-batch/', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  export: async (mode: 'filtered' | 'selected', ids: number[]): Promise<Blob | { async: true; export_id: string; count: number } | { blob: Blob; filename: string }> => {
    const csrfToken = await getCSRFToken();
    const response = await fetch(`${API_BASE_URL}/collaborators/export/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ mode, ids }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(error.detail || 'Export failed');
    }

    // Check if response is JSON (async export) or blob (file download)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Async export
      const data = await response.json();
      return data;
    } else {
      // Synchronous export - extract filename from Content-Disposition header
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      
      // Default fallback with proper format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      let filename = `collaborators_export_${year}-${month}-${day}_${hours}${minutes}${seconds}.xlsx`;
      
      if (contentDisposition) {
        console.log('[API] Content-Disposition header:', contentDisposition);
        // Match filename with or without quotes, handle both filename= and filename*=
        const filenameMatch = contentDisposition.match(/filename\*?=["']?([^"';]+)["']?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
          console.log('[API] Extracted filename:', filename);
        } else {
          console.log('[API] Could not extract filename from header, using fallback');
        }
      } else {
        console.log('[API] No Content-Disposition header found, using fallback');
      }
      
      return { blob, filename };
    }
  },

  exportStatus: async (exportId: string): Promise<{ status: string; filename?: string }> => {
    return apiRequest<{ status: string; filename?: string }>(`/collaborators/export-status/${exportId}/`);
  },

  exportDownload: async (exportId: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/collaborators/export-download/${exportId}/`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Export download failed');
    }

    return response.blob();
  },
};

// Languoids API
export const languoidsAPI = {
  list: (params?: Record<string, string | number>): Promise<PaginatedResponse<Languoid>> => {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiRequest<PaginatedResponse<Languoid>>(`/languoids/${queryString}`);
  },

  get: (id: string | number): Promise<Languoid> => {
    return apiRequest<Languoid>(`/languoids/${id}/`);
  },

  create: (data: Partial<Languoid>): Promise<Languoid> => {
    return apiRequest<Languoid>('/languoids/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: number, data: Partial<Languoid>): Promise<Languoid> => {
    return apiRequest<Languoid>(`/languoids/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  patch: (id: string | number, data: Partial<Languoid>): Promise<Languoid> => {
    return apiRequest<Languoid>(`/languoids/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string | number): Promise<void> => {
    return apiRequest<void>(`/languoids/${id}/`, {
      method: 'DELETE',
    });
  },

  getDescendantsTree: (id: string | number): Promise<LanguoidTreeNode[]> => {
    return apiRequest<LanguoidTreeNode[]>(`/languoids/${id}/descendants-tree/`);
  },

  getLastModified: (): Promise<{ last_modified: string; count: number }> => {
    return apiRequest<{ last_modified: string; count: number }>('/languoids/last-modified/');
  },

  saveBatch: (rows: any[]): Promise<{ success: boolean; saved: Languoid[]; errors: string[] }> => {
    return apiRequest<{ success: boolean; saved: Languoid[]; errors: string[] }>('/languoids/save-batch/', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  export: async (mode: 'filtered' | 'selected', ids: number[]): Promise<Blob | { async: true; export_id: string; count: number } | { blob: Blob; filename: string }> => {
    const csrfToken = await getCSRFToken();
    const response = await fetch(`${API_BASE_URL}/languoids/export/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ mode, ids }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(error.detail || 'Export failed');
    }

    // Check if response is JSON (async export) or blob (file download)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Async export
      const data = await response.json();
      return data;
    } else {
      // Synchronous export - extract filename from Content-Disposition header
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      
      // Default fallback with proper format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      let filename = `languoids_export_${year}-${month}-${day}_${hours}${minutes}${seconds}.xlsx`;
      
      if (contentDisposition) {
        console.log('[API] Content-Disposition header:', contentDisposition);
        const filenameMatch = contentDisposition.match(/filename\*?=["']?([^"';]+)["']?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
          console.log('[API] Extracted filename:', filename);
        } else {
          console.log('[API] Could not extract filename from header, using fallback');
        }
      } else {
        console.log('[API] No Content-Disposition header found, using fallback');
      }
      
      return { blob, filename };
    }
  },

  exportStatus: async (exportId: string): Promise<{ status: string; filename?: string }> => {
    return apiRequest<{ status: string; filename?: string }>(`/languoids/export-status/${exportId}/`);
  },

  exportDownload: async (exportId: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/languoids/export-download/${exportId}/`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Export download failed');
    }

    return response.blob();
  },
};

// Item Titles API - nested under items
export const itemTitlesAPI = {
  list: (itemId: number): Promise<ItemTitle[]> => {
    return apiRequest<ItemTitle[]>(`/items/${itemId}/titles/`);
  },

  get: (itemId: number, titleId: number): Promise<ItemTitle> => {
    return apiRequest<ItemTitle>(`/items/${itemId}/titles/${titleId}/`);
  },

  create: (itemId: number, data: Omit<ItemTitle, 'id' | 'language_name' | 'language_iso'>): Promise<ItemTitle> => {
    return apiRequest<ItemTitle>(`/items/${itemId}/titles/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (itemId: number, titleId: number, data: Partial<Omit<ItemTitle, 'id' | 'language_name' | 'language_iso'>>): Promise<ItemTitle> => {
    return apiRequest<ItemTitle>(`/items/${itemId}/titles/${titleId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  patch: (itemId: number, titleId: number, data: Partial<Omit<ItemTitle, 'id' | 'language_name' | 'language_iso'>>): Promise<ItemTitle> => {
    return apiRequest<ItemTitle>(`/items/${itemId}/titles/${titleId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (itemId: number, titleId: number): Promise<void> => {
    return apiRequest<void>(`/items/${itemId}/titles/${titleId}/`, {
      method: 'DELETE',
    });
  },

  setDefault: (itemId: number, titleId: number): Promise<ItemTitle> => {
    return apiRequest<ItemTitle>(`/items/${itemId}/titles/${titleId}/set_default/`, {
      method: 'POST',
    });
  },
};

// Item Collaborator Roles API - handles CollaboratorRole through-model
export const itemCollaboratorRolesAPI = {
  // Get all collaborator roles for an item
  list: (itemId: number): Promise<CollaboratorRole[]> => {
    return apiRequest<CollaboratorRole[]>(`/items/${itemId}/collaborator-roles/`);
  },

  // Update all collaborator roles for an item (atomic)
  update: (itemId: number, roles: CollaboratorRoleMutationData[]): Promise<CollaboratorRole[]> => {
    return apiRequest<CollaboratorRole[]>(`/items/${itemId}/collaborator-roles/`, {
      method: 'PATCH',
      body: JSON.stringify(roles),
    });
  },
};
