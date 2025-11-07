import React from 'react';
import { Box, Typography } from '@mui/material';

export const DateFormatHelp: React.FC = () => {
  return (
    <Box sx={{ mt: 1, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
      <Typography variant="caption" sx={{ fontWeight: 'medium', display: 'block', mb: 1 }}>
        📅 Accepted Date Formats (preferred format shown first):
      </Typography>
      <Typography variant="caption" component="div" sx={{ lineHeight: 1.3 }}>
        <strong>Years:</strong> 2023, 1990s, 1990s?, 2020-2025<br/>
        <strong>Months:</strong> 2023/03, March 2023, 3/2023<br/>
        <strong>Full Dates:</strong> 2023/03/15, 3/15/2023<br/>
        <strong>Date Ranges:</strong> 2020/03-2023/10, 1/2020-3/2021, 2020-2023<br/>
        <strong>Approximate:</strong> ca 2023, 19th century, early 2020s<br/>
        <strong>Partial/Uncertain:</strong> 2023?, Spring 2023, circa 1950
      </Typography>
    </Box>
  );
};

export default DateFormatHelp;
