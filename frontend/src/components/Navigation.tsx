import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserInfo from './UserInfo';
import { ariaLabels, keyboardUtils } from '../utils/accessibility';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { state } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Home', path: '/' },
    ...(state.isAuthenticated ? [
      { label: 'Items', path: '/items' },
      { label: 'Collections', path: '/collections' },
      { label: 'Collaborators', path: '/collaborators' },
      { label: 'Languages', path: '/languoids' },
      { label: 'User Guide', path: '/user-guide' },
    ] : [
      { label: 'Login', path: '/login' },
    ]),
  ];

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === keyboardUtils.keys.ESCAPE) {
      handleMobileMenuClose();
    }
  };

  // Mobile menu component
  const MobileMenu = () => (
    <Drawer
      anchor="left"
      open={mobileMenuOpen}
      onClose={handleMobileMenuClose}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
      PaperProps={{
        sx: {
          width: 280,
          maxWidth: '80vw',
        },
        role: 'navigation',
        'aria-label': ariaLabels.mainNavigation,
      }}
      onKeyDown={handleKeyDown}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          NAL Archive
        </Typography>
        <IconButton
          onClick={handleMobileMenuClose}
          aria-label={ariaLabels.closeDialog}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </Box>
      
      <List component="nav" aria-label={ariaLabels.mainNavigation}>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
              onClick={handleMobileMenuClose}
              sx={{
                minHeight: '48px', // Touch-friendly height
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.light,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main,
                  },
                },
              }}
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              <ListItemText 
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: location.pathname === item.path ? 'bold' : 'normal',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* User info in mobile menu */}
      {state.isAuthenticated && (
        <Box sx={{ mt: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>
          <UserInfo mobile />
        </Box>
      )}
    </Drawer>
  );

  // Desktop navigation
  const DesktopNav = () => (
    <Box 
      sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
      component="nav"
      aria-label={ariaLabels.mainNavigation}
    >
      {navItems.map((item) => (
        <Button
          key={item.path}
          color="inherit"
          component={Link}
          to={item.path}
          variant={location.pathname === item.path ? 'outlined' : 'text'}
          sx={{ 
            borderColor: location.pathname === item.path ? 'white' : 'transparent',
            color: 'white',
            minHeight: '44px', // Touch-friendly minimum
            textTransform: 'none', // Better readability
            fontWeight: location.pathname === item.path ? 'bold' : 'normal',
          }}
          aria-current={location.pathname === item.path ? 'page' : undefined}
        >
          {item.label}
        </Button>
      ))}
      {state.isAuthenticated && <UserInfo />}
    </Box>
  );

  return (
    <>
      <AppBar 
        position="static" 
        component="header"
        role="banner"
      >
        <Toolbar sx={{ minHeight: { xs: '56px', sm: '64px' } }}>
          {/* Mobile menu button */}
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label={ariaLabels.mobileMenuToggle}
              onClick={handleMobileMenuToggle}
              sx={{ 
                mr: 2,
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo/Title */}
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1.1rem', sm: '1.25rem' }, // Responsive font size
            }}
          >
            <Link 
              to="/" 
              style={{ 
                color: 'inherit', 
                textDecoration: 'none',
                display: 'block',
                padding: '8px 0', // Increase clickable area
              }}
              aria-label="NAL Archive home"
            >
              NAL Archive
            </Link>
          </Typography>

          {/* Desktop navigation */}
          {!isMobile && <DesktopNav />}
        </Toolbar>
      </AppBar>

      {/* Mobile menu drawer */}
      {isMobile && <MobileMenu />}
    </>
  );
};

export default Navigation;