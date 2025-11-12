import React from 'react';
import { Container, Box } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import CollaboratorsList from '../components/collaborators/CollaboratorsList';
import CollaboratorDetail from '../components/collaborators/CollaboratorDetail';
import CollaboratorCreate from '../components/collaborators/CollaboratorCreate';
import { CollaboratorBatchEditor } from '../components/collaborators/CollaboratorBatchEditor';

const CollaboratorsPage: React.FC = () => {
  usePageTitle('Collaborators');
  
  return (
    <Routes>
      {/* Batch editor needs full width - render without Container */}
      <Route path="/batch" element={<CollaboratorBatchEditor />} />
      
      {/* Other routes use Container for standard width */}
      <Route path="/*" element={
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Routes>
          <Route path="/" element={<CollaboratorsList />} />
          <Route path="/create" element={<CollaboratorCreate />} />
          <Route path="/:id" element={<CollaboratorDetail />} />
        </Routes>
      </Box>
    </Container>
      } />
    </Routes>
  );
};

export default CollaboratorsPage;
