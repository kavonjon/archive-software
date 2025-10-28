import React from 'react';
import { Typography, Container, Paper, Box, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const HomePage: React.FC = () => {
  const { state } = useAuth();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Native American Languages Archive
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Digital repository management system for cultural and linguistic heritage materials
          </Typography>
          
          {!state.isAuthenticated ? (
            <>
              <Typography variant="body1" paragraph sx={{ mt: 3 }}>
                This system is for authorized museum staff and archivists. Please log in to access the archive.
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Button
                  component={Link}
                  to="/login"
                  variant="contained"
                  size="large"
                  startIcon={<LoginIcon />}
                  sx={{ minHeight: '48px', px: 4 }}
                >
                  Login to Access Archive
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography variant="body1" paragraph>
                Welcome to the NAL Archive system. Use the navigation above to access:
              </Typography>
              <Box component="ul" sx={{ lineHeight: 1.8 }}>
                <li>
                  <Typography variant="body1">
                    <strong>Items</strong> - Catalog entries with rich metadata
                  </Typography>
                </li>
                <li>
                  <Typography variant="body1">
                    <strong>Collections</strong> - Organized groupings of related materials
                  </Typography>
                </li>
                <li>
                  <Typography variant="body1">
                    <strong>Collaborators</strong> - People involved in creating or contributing to archived materials
                  </Typography>
                </li>
                <li>
                  <Typography variant="body1">
                    <strong>Languages</strong> - Languages and dialects for linguistic heritage documentation
                  </Typography>
                </li>
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default HomePage;
