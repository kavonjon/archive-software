import React from 'react';
import { Container, Box } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import ItemsList from '../components/items/ItemsList';
import ItemDetail from '../components/items/ItemDetail';
import ItemCreate from '../components/items/ItemCreate';
import { ItemBatchEditor } from '../components/items/ItemBatchEditor';

const ItemsPage: React.FC = () => {
  usePageTitle('Items');
  
  return (
    <Routes>
      {/* Batch editor needs full width - render without Container */}
      <Route path="/batch" element={<ItemBatchEditor />} />
      
      {/* Other routes use Container for standard width */}
      <Route path="/*" element={
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
            <Routes>
              <Route path="/" element={<ItemsList />} />
              <Route path="/create" element={<ItemCreate />} />
              <Route path="/:id" element={<ItemDetail />} />
            </Routes>
      </Box>
    </Container>
      } />
    </Routes>
  );
};

export default ItemsPage;
