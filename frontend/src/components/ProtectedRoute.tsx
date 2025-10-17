import React, { ReactNode, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography, Alert, Container } from '@mui/material';
import LoginForm from './LoginForm';
import { focusUtils } from '../utils/accessibility';

interface ProtectedRouteProps {
  children: ReactNode;
  requireStaff?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireStaff = false }) => {
  const { state } = useAuth();

  // Announce authentication state changes to screen readers
  useEffect(() => {
    if (!state.isLoading) {
      if (!state.isAuthenticated) {
        focusUtils.announce('Please log in to access this page', 'polite');
      } else if (requireStaff && (!state.user || !state.user.is_staff)) {
        focusUtils.announce('Access denied: Staff privileges required', 'assertive');
      }
    }
  }, [state.isLoading, state.isAuthenticated, state.user, requireStaff]);

  // Loading state
  if (state.isLoading) {
    return (
      <Container maxWidth="md">
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '60vh',
            gap: 2,
          }}
          role="main"
          aria-live="polite"
          aria-label="Loading authentication status"
        >
          <CircularProgress size={48} aria-label="Checking authentication" />
          <Typography variant="body1" color="text.secondary">
            Checking authentication...
          </Typography>
        </Box>
      </Container>
    );
  }

  // Not authenticated
  if (!state.isAuthenticated) {
    return (
      <Box role="main" aria-labelledby="login-required">
        <Typography 
          id="login-required" 
          variant="h2" 
          sx={{ 
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          Login Required
        </Typography>
        <LoginForm />
      </Box>
    );
  }

  // Authenticated but insufficient privileges
  if (requireStaff && (!state.user || !state.user.is_staff)) {
    return (
      <Container maxWidth="md">
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '60vh',
            gap: 2,
            textAlign: 'center',
          }}
          role="main"
          aria-labelledby="access-denied"
        >
          <Alert 
            severity="error" 
            sx={{ 
              width: '100%', 
              maxWidth: '600px',
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
            role="alert"
            aria-live="assertive"
          >
            <Typography 
              id="access-denied"
              variant="h6" 
              component="h1"
              gutterBottom
              sx={{ fontWeight: 'medium' }}
            >
              Access Denied
            </Typography>
            <Typography variant="body1">
              You need staff privileges to access this page. Please contact an administrator if you believe this is an error.
            </Typography>
          </Alert>
        </Box>
      </Container>
    );
  }

  // Authenticated and authorized
  return (
    <Box 
      role="main" 
      sx={{ width: '100%' }}
      aria-label="Protected content"
    >
      {children}
    </Box>
  );
};

export default ProtectedRoute;