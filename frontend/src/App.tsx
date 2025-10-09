import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import { store } from './store/store';

// Pages
import HomePage from './pages/HomePage';
import ItemsPage from './pages/ItemsPage';
import CollectionsPage from './pages/CollectionsPage';
import CollaboratorsPage from './pages/CollaboratorsPage';
import LanguoidsPage from './pages/LanguoidsPage';

// Components
import Navigation from './components/Navigation';

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
        <Router>
          <div className="App">
            <Navigation />
            <main style={{ padding: '20px' }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/items/*" element={<ItemsPage />} />
                <Route path="/collections/*" element={<CollectionsPage />} />
                <Route path="/collaborators/*" element={<CollaboratorsPage />} />
                <Route path="/languoids/*" element={<LanguoidsPage />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ThemeProvider>
    </Provider>
  );
}

export default App;