import React from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const UserInfo: React.FC = () => {
  const { state, logout } = useAuth();

  if (!state.isAuthenticated || !state.user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
  };

  const { user } = state;

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2,
      color: 'white'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ color: 'white' }}>
          {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
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
