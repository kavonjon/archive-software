import React from 'react';
import { Container, Box } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import CollaboratorsList from '../components/collaborators/CollaboratorsList';
import CollaboratorDetail from '../components/collaborators/CollaboratorDetail';
import CollaboratorCreate from '../components/collaborators/CollaboratorCreate';

const CollaboratorsPage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Routes>
          <Route path="/" element={<CollaboratorsList />} />
          <Route path="/create" element={<CollaboratorCreate />} />
          <Route path="/:id" element={<CollaboratorDetail />} />
        </Routes>
      </Box>
    </Container>
  );
};

export default CollaboratorsPage;
