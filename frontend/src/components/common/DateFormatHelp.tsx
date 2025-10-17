import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';

export const DateFormatHelp: React.FC = () => {
  return (
    <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
      <Typography variant="caption" sx={{ fontWeight: 'medium', display: 'block', mb: 1 }}>
        Accepted date formats:
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label="2023" size="small" variant="outlined" />
        <Chip label="2023/03" size="small" variant="outlined" />
        <Chip label="2023/03/15" size="small" variant="outlined" />
        <Chip label="03/15/2023" size="small" variant="outlined" />
        <Chip label="2020-2023" size="small" variant="outlined" />
        <Chip label="2023/03-2024/05" size="small" variant="outlined" />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        American format (MM/DD/YYYY) will be converted to standard format (YYYY/MM/DD) when saved.
      </Typography>
    </Box>
  );
};

export default DateFormatHelp;
