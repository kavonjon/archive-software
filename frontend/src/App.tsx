import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { AuthProvider } from './contexts/AuthContext';
import { LanguoidCacheProvider } from './contexts/LanguoidCacheContext';

// Pages
import HomePage from './pages/HomePage';
import ItemsPage from './pages/ItemsPage';
import CollectionsPage from './pages/CollectionsPage';
import CollaboratorsPage from './pages/CollaboratorsPage';
import LanguoidsPage from './pages/LanguoidsPage';
import { UserGuidePage } from './pages/UserGuidePage';

// Components
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import LoginForm from './components/LoginForm';

// Accessibility testing (development only)
if (process.env.NODE_ENV === 'development') {
  const axe = require('@axe-core/react');
  const React = require('react');
  const ReactDOM = require('react-dom');
  axe(React, ReactDOM, 1000);
}

const theme = createTheme({
  palette: {
    mode: 'light',
  },
  // Accessibility improvements
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: '44px', // Touch-friendly minimum size
          textTransform: 'none', // Better readability
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: '44px',
          minHeight: '44px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            minHeight: '44px',
          },
        },
      },
    },
  },
  // Responsive breakpoints
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
});

function App() {
  // Focus management for route changes
  useEffect(() => {
    const handleRouteChange = () => {
      // Announce route changes to screen readers
      const mainContent = document.querySelector('#main-content') as HTMLElement;
      if (mainContent) {
        mainContent.focus();
      }
    };

    // Listen for route changes
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <LanguoidCacheProvider>
            <Router>
              <div className="App">
              {/* Skip link for keyboard navigation */}
              <a 
                href="#main-content" 
                style={{
                  position: 'absolute',
                  top: '-40px',
                  left: '6px',
                  background: '#1976d2',
                  color: 'white',
                  padding: '8px',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  zIndex: 1000,
                  transition: 'top 0.3s',
                }}
                onFocus={(e) => {
                  e.target.style.top = '6px';
                }}
                onBlur={(e) => {
                  e.target.style.top = '-40px';
                }}
              >
                Skip to main content
              </a>
              
              <Navigation />
              
              <main 
                id="main-content" 
                tabIndex={-1}
                style={{ 
                  padding: '20px',
                  outline: 'none' // Remove focus outline since this is programmatically focused
                }}
                role="main"
                aria-label="Main content"
              >
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginForm />} />
                  <Route path="/user-guide" element={<UserGuidePage />} />
                  <Route 
                    path="/items/*" 
                    element={
                      <ProtectedRoute>
                        <ItemsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/collections/*" 
                    element={
                      <ProtectedRoute>
                        <CollectionsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/collaborators/*" 
                    element={
                      <ProtectedRoute>
                        <CollaboratorsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/languoids/*" 
                    element={
                      <ProtectedRoute>
                        <LanguoidsPage />
                      </ProtectedRoute>
                    } 
                  />
                </Routes>
              </main>
            </div>
          </Router>
          </LanguoidCacheProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;