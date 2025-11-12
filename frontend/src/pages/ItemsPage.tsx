import React from 'react';
import { Container, Box } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import ItemsList from '../components/items/ItemsList';
import ItemDetail from '../components/items/ItemDetail';
import ItemCreate from '../components/items/ItemCreate';

const ItemsPage: React.FC = () => {
  usePageTitle('Items');
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
            <Routes>
              <Route path="/" element={<ItemsList />} />
              <Route path="/create" element={<ItemCreate />} />
              <Route path="/:id" element={<ItemDetail />} />
            </Routes>
      </Box>
    </Container>
  );
};

export default ItemsPage;
