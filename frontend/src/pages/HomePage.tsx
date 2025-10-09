import React from 'react';
import { Typography, Container, Paper, Box } from '@mui/material';

const HomePage: React.FC = () => {
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
          <Typography variant="body1" paragraph>
            Welcome to the NAL Archive system. Use the navigation above to access:
          </Typography>
          <ul>
            <li><strong>Items</strong> - Catalog entries with rich metadata</li>
            <li><strong>Collections</strong> - Organized groupings of related materials</li>
            <li><strong>Collaborators</strong> - People involved in creating or contributing to archived materials</li>
            <li><strong>Languoids</strong> - Languages and dialects for linguistic heritage documentation</li>
          </ul>
        </Paper>
      </Box>
    </Container>
  );
};

export default HomePage;
