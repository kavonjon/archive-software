import React from 'react';
import { Typography, Container, Paper, Box } from '@mui/material';

const LanguoidsPage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>Languoids</Typography>
          <Typography variant="body1">
            Languages and dialects management interface will be implemented here.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default LanguoidsPage;
