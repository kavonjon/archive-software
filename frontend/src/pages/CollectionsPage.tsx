import React from 'react';
import { Typography, Container, Paper, Box } from '@mui/material';

const CollectionsPage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>Collections</Typography>
          <Typography variant="body1">
            Collections management interface will be implemented here.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default CollectionsPage;
