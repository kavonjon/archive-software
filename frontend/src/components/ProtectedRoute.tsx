import React, { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography, Alert, Container } from '@mui/material';
import { focusUtils } from '../utils/accessibility';
import { hasViewAccess, hasEditAccess } from '../utils/permissions';

interface ProtectedRouteProps {
  children: ReactNode;
  requireEditAccess?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireEditAccess = false }) => {
  const { state } = useAuth();
  const location = useLocation();

  // Announce authentication state changes to screen readers
  useEffect(() => {
    if (!state.isLoading) {
      if (!state.isAuthenticated) {
        focusUtils.announce('Please log in to access this page', 'polite');
      } else if (!hasViewAccess(state.user)) {
        focusUtils.announce('Access denied: You must be assigned to a user group', 'assertive');
      } else if (requireEditAccess && !hasEditAccess(state.user)) {
        focusUtils.announce('Access denied: Edit privileges required', 'assertive');
      }
    }
  }, [state.isLoading, state.isAuthenticated, state.user, requireEditAccess]);

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

  // Not authenticated - redirect to login with return path
  if (!state.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but no group assignment
  if (!hasViewAccess(state.user)) {
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
              Your account is not assigned to a user group. Please contact an administrator to be added to the Archivist, Museum Staff, or Read-Only group.
            </Typography>
          </Alert>
        </Box>
      </Container>
    );
  }

  // Authenticated with view access but insufficient edit privileges
  if (requireEditAccess && !hasEditAccess(state.user)) {
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
              You need edit privileges to access this page. Please contact an administrator if you believe this is an error.
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