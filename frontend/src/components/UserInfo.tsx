import React from 'react';
import { Box, Typography, Chip, Button, Stack } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { ariaLabels } from '../utils/accessibility';

interface UserInfoProps {
  mobile?: boolean;
}

const UserInfo: React.FC<UserInfoProps> = ({ mobile = false }) => {
  const { state, logout } = useAuth();

  if (!state.isAuthenticated || !state.user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
  };

  const { user } = state;
  const displayName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.username;

  if (mobile) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 1,
          p: 1,
        }}
        role="region"
        aria-label={ariaLabels.userMenu}
      >
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          {displayName}
        </Typography>
        
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {user.is_staff && (
            <Chip 
              label="Staff" 
              size="small" 
              color="primary"
              sx={{ fontSize: '0.75rem' }} 
            />
          )}
          {user.is_superuser && (
            <Chip 
              label="Admin" 
              size="small" 
              color="error"
              sx={{ fontSize: '0.75rem' }} 
            />
          )}
        </Stack>
        
        <Button
          onClick={handleLogout}
          variant="outlined"
          size="small"
          fullWidth
          sx={{
            mt: 1,
            minHeight: '44px', // Touch-friendly
            textTransform: 'none',
          }}
        >
          Logout
        </Button>
      </Box>
    );
  }

  // Desktop layout
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2,
      color: 'white'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ color: 'white' }}>
          {displayName}
        </Typography>
        {user.is_staff && (
          <Chip 
            label="Staff" 
            size="small" 
            sx={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.2)', 
              color: 'white',
              fontSize: '0.75rem'
            }} 
          />
        )}
        {user.is_superuser && (
          <Chip 
            label="Admin" 
            size="small" 
            sx={{ 
              backgroundColor: '#d32f2f', 
              color: 'white',
              fontSize: '0.75rem'
            }} 
          />
        )}
      </Box>
      
      <Button
        onClick={handleLogout}
        variant="outlined"
        size="small"
        sx={{
          color: 'white',
          borderColor: 'white',
          minHeight: '44px', // Touch-friendly
          textTransform: 'none',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'white',
          }
        }}
      >
        Logout
      </Button>
    </Box>
  );
};

export default UserInfo;
