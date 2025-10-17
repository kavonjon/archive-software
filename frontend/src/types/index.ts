/**
 * TypeScript type definitions for the archive application
 */

// Re-export types from API service for convenience
export type {
  Item,
  Collection,
  Collaborator,
  Languoid,
  PaginatedResponse,
  APIError,
} from '../services/api';

// Additional UI-specific types
export interface FilterState {
  [key: string]: string;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SelectionState<T> {
  selectedItems: T[];
  isAllSelected: boolean;
  isIndeterminate: boolean;
}

// Authentication types (re-export from context)
export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Component prop types
export interface ListComponentProps<T> {
  showActions?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedItems: T[]) => void;
}

export interface FormComponentProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  initialData?: any;
  isLoading?: boolean;
  error?: string | null;
}

// Responsive breakpoint types
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Accessibility types
export interface AriaProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-atomic'?: boolean;
  role?: string;
}

export default {};
