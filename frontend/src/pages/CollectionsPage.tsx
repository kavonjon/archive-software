import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';
import CollectionsList from '../components/collections/CollectionsList';
import CollectionDetail from '../components/collections/CollectionDetail';
import CollectionCreate from '../components/collections/CollectionCreate';

const CollectionsPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Routes>
        {/* Collections list page */}
        <Route index element={<CollectionsList />} />
        
        {/* Collection Create page */}
        <Route path="create" element={<CollectionCreate />} />
        
        {/* Collection Detail page */}
        <Route path=":id" element={<CollectionDetail />} />
      </Routes>
    </Container>
  );
};

export default CollectionsPage;