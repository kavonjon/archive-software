import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { AuthProvider } from './contexts/AuthContext';

// Pages
import HomePage from './pages/HomePage';
import ItemsPage from './pages/ItemsPage';
import CollectionsPage from './pages/CollectionsPage';
import CollaboratorsPage from './pages/CollaboratorsPage';
import LanguoidsPage from './pages/LanguoidsPage';

// Components
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <div className="App">
              <Navigation />
              <main style={{ padding: '20px' }}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route 
                    path="/items/*" 
                    element={
                      <ProtectedRoute requireStaff={true}>
                        <ItemsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/collections/*" 
                    element={
                      <ProtectedRoute requireStaff={true}>
                        <CollectionsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/collaborators/*" 
                    element={
                      <ProtectedRoute requireStaff={true}>
                        <CollaboratorsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/languoids/*" 
                    element={
                      <ProtectedRoute requireStaff={true}>
                        <LanguoidsPage />
                      </ProtectedRoute>
                    } 
                  />
                </Routes>
              </main>
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;