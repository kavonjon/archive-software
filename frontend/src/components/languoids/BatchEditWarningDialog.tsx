import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

export type WarningType = 'large-filtered' | 'large-selected' | 'all-preset';

export interface WarningConfig {
  type: WarningType;
  count: number;
  mode: 'filtered' | 'selected';
  preset?: 'all' | 'languages' | 'dialects' | 'languages_dialects' | 'families';
}

interface BatchEditWarningDialogProps {
  open: boolean;
  config: WarningConfig | null;
  onCancel: () => void;
  onContinue: (suppressFuture: boolean) => void;
}

const BatchEditWarningDialog: React.FC<BatchEditWarningDialogProps> = ({
  open,
  config,
  onCancel,
  onContinue,
}) => {
  const [suppressWarning, setSuppressWarning] = useState(false);

  if (!config) return null;

  // Generate title and body text based on warning scenario
  const getWarningContent = (): { title: string; body: string; suggestions?: string[] } => {
    const { type, count, mode, preset } = config;

    // Scenario A: >100 items, Batch Edit Filtered Results pressed
    if (type === 'large-filtered' && mode === 'filtered') {
      return {
        title: 'Large Dataset Warning',
        body: `You are about to load ${count} languoids into the batch editor. Loading more than 100 items may be slow.`,
        suggestions: ['Consider using more specific filters to reduce the dataset.'],
      };
    }

    // Scenario B: >100 items, Batch Edit Selected pressed
    if (type === 'large-selected' && mode === 'selected') {
      return {
        title: 'Large Dataset Warning',
        body: `You are about to load ${count} languoids into the batch editor. Loading more than 100 items may be slow.`,
        suggestions: ['Consider selecting fewer languoids to reduce the dataset.'],
      };
    }

    // Scenarios C1-C5: Preset-only filters (no advanced filters)
    if (type === 'all-preset') {
      switch (preset) {
        case 'all':
          return {
            title: 'Load All Languoids?',
            body: `You are about to load all languoids (${count} total) into the batch editor.`,
            suggestions: [
              'Applying advanced filters',
              'Selecting specific items with checkboxes',
            ],
          };

        case 'languages':
          return {
            title: 'Load All Languages?',
            body: `You are about to load all languages (${count} total) into the batch editor.`,
            suggestions: [
              'Applying advanced filters',
              'Selecting specific items with checkboxes',
            ],
          };

        case 'dialects':
          return {
            title: 'Load All Dialects?',
            body: `You are about to load all dialects (${count} total) into the batch editor.`,
            suggestions: [
              'Applying advanced filters',
              'Selecting specific items with checkboxes',
            ],
          };

        case 'languages_dialects':
          return {
            title: 'Load All Languages & Dialects?',
            body: `You are about to load all languages and dialects (${count} total) into the batch editor.`,
            suggestions: [
              'Applying advanced filters',
              'Selecting specific items with checkboxes',
            ],
          };

        case 'families':
          return {
            title: 'Load All Families?',
            body: `You are about to load all families (${count} total) into the batch editor.`,
            suggestions: [
              'Applying advanced filters',
              'Selecting specific items with checkboxes',
            ],
          };
      }
    }

    // Fallback (should never reach here)
    return {
      title: 'Warning',
      body: `You are about to load ${count} languoids into the batch editor.`,
    };
  };

  const { title, body, suggestions } = getWarningContent();

  const handleContinue = () => {
    onContinue(suppressWarning);
    setSuppressWarning(false); // Reset for next time
  };

  const handleCancel = () => {
    onCancel();
    setSuppressWarning(false); // Reset for next time
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        {title}
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          {body}
        </Typography>
        
        {suggestions && suggestions.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Consider:
            </Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 3 }}>
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <Typography variant="body2" color="text.secondary">
                    {suggestion}
                  </Typography>
                </li>
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ mt: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={suppressWarning}
                onChange={(e) => setSuppressWarning(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                Don't show this warning again
              </Typography>
            }
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleContinue} variant="contained" color="primary">
          Continue Anyway
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchEditWarningDialog;

