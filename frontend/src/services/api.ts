/**
 * API service layer for making authenticated requests to Django backend
 */

// Base API configuration
const API_BASE_URL = '/internal/v1';

// Types for API responses
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Item {
  id: number;
  catalog_number: string;
  call_number: string;
  access_level: string;
  accession_date: string | null;
  creation_date: string | null;
  resource_type: string;
  genre: string[];
  description_scope_and_content: string;
  depositor_name: string;
  keywords: string;
  collection: number | null;
  collection_name?: string;
  language: number[];
  language_names?: string[];
  collaborator: number[];
  collaborator_names?: string[];
  titles?: ItemTitle[];
  uuid: string;
  slug: string;
}

export interface ItemTitle {
  id: number;
  title: string;
  language: number | null;
  language_name?: string;
  default: boolean;
}

export interface Collection {
  id: number;
  name: string;
  collection_abbr: string;
  extent: string;
  date_range: string;
  abstract: string;
  item_count?: number;
  uuid: string;
  slug: string;
}

export interface Collaborator {
  id: number;
  name: string;
  email: string;
  native_languages: number[];
  native_language_names?: string[];
  other_languages: number[];
  other_language_names?: string[];
  slug: string;
}

export interface Languoid {
  id: number;
  name: string;
  iso: string;
  glottocode: string;
  language_family: string;
  alt_names: string[];
  dialects_languoids: number[];
}

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
  const response = await fetch('/auth/csrf/', {
    credentials: 'include',
  });
  const data = await response.json();
  return data.csrfToken;
};

// Generic API request function with authentication
const apiRequest = async <T>(
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

  return response.json();
};

// Items API
export const itemsAPI = {
  // Get paginated list of items with optional filtering
  list: (params?: Record<string, string | number>): Promise<PaginatedResponse<Item>> => {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiRequest<PaginatedResponse<Item>>(`/items/${queryString}`);
  },

  // Get single item by ID
  get: (id: number): Promise<Item> => {
    return apiRequest<Item>(`/items/${id}/`);
  },

  // Create new item
  create: (data: Partial<Item>): Promise<Item> => {
    return apiRequest<Item>('/items/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update existing item
  update: (id: number, data: Partial<Item>): Promise<Item> => {
    return apiRequest<Item>(`/items/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Partial update (patch) existing item
  patch: (id: number, data: Partial<Item>): Promise<Item> => {
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
};

// Collections API
export const collectionsAPI = {
  list: (params?: Record<string, string | number>): Promise<PaginatedResponse<Collection>> => {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiRequest<PaginatedResponse<Collection>>(`/collections/${queryString}`);
  },

  get: (id: number): Promise<Collection> => {
    return apiRequest<Collection>(`/collections/${id}/`);
  },

  create: (data: Partial<Collection>): Promise<Collection> => {
    return apiRequest<Collection>('/collections/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: number, data: Partial<Collection>): Promise<Collection> => {
    return apiRequest<Collection>(`/collections/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  patch: (id: number, data: Partial<Collection>): Promise<Collection> => {
    return apiRequest<Collection>(`/collections/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number): Promise<void> => {
    return apiRequest<void>(`/collections/${id}/`, {
      method: 'DELETE',
    });
  },
};

// Collaborators API
export const collaboratorsAPI = {
  list: (params?: Record<string, string | number>): Promise<PaginatedResponse<Collaborator>> => {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiRequest<PaginatedResponse<Collaborator>>(`/collaborators/${queryString}`);
  },

  get: (id: number): Promise<Collaborator> => {
    return apiRequest<Collaborator>(`/collaborators/${id}/`);
  },

  create: (data: Partial<Collaborator>): Promise<Collaborator> => {
    return apiRequest<Collaborator>('/collaborators/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: number, data: Partial<Collaborator>): Promise<Collaborator> => {
    return apiRequest<Collaborator>(`/collaborators/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  patch: (id: number, data: Partial<Collaborator>): Promise<Collaborator> => {
    return apiRequest<Collaborator>(`/collaborators/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number): Promise<void> => {
    return apiRequest<void>(`/collaborators/${id}/`, {
      method: 'DELETE',
    });
  },
};

// Languoids API
export const languoidsAPI = {
  list: (params?: Record<string, string | number>): Promise<PaginatedResponse<Languoid>> => {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiRequest<PaginatedResponse<Languoid>>(`/languoids/${queryString}`);
  },

  get: (id: number): Promise<Languoid> => {
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

  patch: (id: number, data: Partial<Languoid>): Promise<Languoid> => {
    return apiRequest<Languoid>(`/languoids/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number): Promise<void> => {
    return apiRequest<void>(`/languoids/${id}/`, {
      method: 'DELETE',
    });
  },
};
