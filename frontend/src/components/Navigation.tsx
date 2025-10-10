import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserInfo from './UserInfo';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { state } = useAuth();

  const navItems = [
    { label: 'Home', path: '/' },
    ...(state.isAuthenticated ? [
      { label: 'Items', path: '/items' },
      { label: 'Collections', path: '/collections' },
      { label: 'Collaborators', path: '/collaborators' },
      { label: 'Languoids', path: '/languoids' },
    ] : []),
  ];

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          NAL Archive
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              component={Link}
              to={item.path}
              variant={location.pathname === item.path ? 'outlined' : 'text'}
              sx={{ 
                borderColor: location.pathname === item.path ? 'white' : 'transparent',
                color: 'white'
              }}
            >
              {item.label}
            </Button>
          ))}
          {state.isAuthenticated && <UserInfo />}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;
