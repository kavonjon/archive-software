import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';

interface ProtectedRouteProps {
  children: ReactNode;
  requireStaff?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireStaff = false }) => {
  const { state } = useAuth();

  // Show loading spinner while checking authentication
  if (state.isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    );
  }

  // Show login form if not authenticated
  if (!state.isAuthenticated) {
    return <LoginForm />;
  }

  // Check staff requirement
  if (requireStaff && state.user && !state.user.is_staff) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem',
        color: '#d32f2f'
      }}>
        <h2>Access Denied</h2>
        <p>You need staff privileges to access this page.</p>
      </div>
    );
  }

  // User is authenticated and has required permissions
  return <>{children}</>;
};

export default ProtectedRoute;
