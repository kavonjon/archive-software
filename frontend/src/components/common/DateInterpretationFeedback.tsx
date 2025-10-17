import React from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useDateInterpretation } from '../../hooks/useDateInterpretation';

interface DateInterpretationFeedbackProps {
  value: string;
  show?: boolean;
}

/**
 * Component that provides real-time feedback about date input interpretation.
 * 
 * Shows users what will happen to their date input when saved:
 * - ✓ Already in preferred format (green)
 * - → Will be converted (blue with preview)
 * - ? Unrecognized format (gray)
 * 
 * Uses logic that mirrors Django backend: app/metadata/signals.py - standardize_date_format()
 */
export const DateInterpretationFeedback: React.FC<DateInterpretationFeedbackProps> = ({
  value,
  show = true
}) => {
  const interpretation = useDateInterpretation(value);

  if (!show || interpretation.status === 'empty') {
    return null;
  }

  const getIcon = () => {
    switch (interpretation.status) {
      case 'preferred':
        return <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'convertible':
        return <ArrowForwardIcon sx={{ fontSize: 16, color: 'info.main' }} />;
      case 'unrecognized':
        return <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
      default:
        return null;
    }
  };

  const getColor = () => {
    switch (interpretation.status) {
      case 'preferred':
        return 'success.main';
      case 'convertible':
        return 'info.main';
      case 'unrecognized':
        return 'text.secondary';
      default:
        return 'text.secondary';
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5, 
        mt: 0.5,
        minHeight: '20px' // Prevent layout shift
      }}
    >
      {getIcon()}
      <Typography 
        variant="caption" 
        sx={{ 
          color: getColor(),
          fontSize: '0.75rem',
          lineHeight: 1.2
        }}
      >
        {interpretation.message}
      </Typography>
    </Box>
  );
};
