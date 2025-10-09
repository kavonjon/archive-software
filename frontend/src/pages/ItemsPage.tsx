import React from 'react';
import { Typography, Container, Paper, Box } from '@mui/material';
import { Routes, Route } from 'react-router-dom';

const ItemsList: React.FC = () => (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h4" gutterBottom>Items</Typography>
    <Typography variant="body1">
      Items list view will be implemented here with search, filtering, and inline editing capabilities.
    </Typography>
  </Paper>
);

const ItemDetail: React.FC = () => (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h4" gutterBottom>Item Detail</Typography>
    <Typography variant="body1">
      Item detail view with inline editing will be implemented here.
    </Typography>
  </Paper>
);

const ItemsPage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Routes>
          <Route path="/" element={<ItemsList />} />
          <Route path="/:id" element={<ItemDetail />} />
        </Routes>
      </Box>
    </Container>
  );
};

export default ItemsPage;
