import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

// Context
interface AuthContextType {
  state: AuthState;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Get CSRF token
  const getCSRFToken = async (): Promise<string> => {
    const response = await fetch('http://localhost:8000/auth/csrf/', {
      credentials: 'include',
    });
    const data = await response.json();
    return data.csrfToken;
  };

  // Check authentication status
  const checkAuthStatus = async (): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await fetch('http://localhost:8000/auth/status/', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          dispatch({ type: 'AUTH_SUCCESS', payload: data.user });
        } else {
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      } else {
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const csrfToken = await getCSRFToken();
      
      const response = await fetch('http://localhost:8000/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        dispatch({ type: 'AUTH_SUCCESS', payload: data.user });
        return true;
      } else {
        dispatch({ type: 'AUTH_FAILURE', payload: data.error || 'Login failed' });
        return false;
      }
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE', payload: 'Network error occurred' });
      return false;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      const csrfToken = await getCSRFToken();
      
      await fetch('http://localhost:8000/auth/logout/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });
      
      dispatch({ type: 'AUTH_LOGOUT' });
    } catch (error) {
      console.error('Logout failed:', error);
      // Still logout locally even if server request fails
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Clear error
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const value: AuthContextType = {
    state,
    login,
    logout,
    checkAuthStatus,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
