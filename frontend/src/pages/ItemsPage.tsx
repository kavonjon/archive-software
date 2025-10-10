import React from 'react';
import { Typography, Container, Paper, Box } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import ItemsList from '../components/items/ItemsList';

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
