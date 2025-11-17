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
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { Warning as WarningIcon, DataUsage as DataIcon } from '@mui/icons-material';

export interface LoadingDialogState {
  // Loading state (Scenario B or A+B)
  cacheLoading: boolean;
  cacheProgress: number; // 0-100
  totalCount: number;
  
  // Warning state (Scenario A or A+B)
  showLargeDatasetWarning: boolean;
  rowCount: number;
  mode?: 'filtered' | 'selected';
}

interface ItemBatchLoadingDialogProps {
  open: boolean;
  state: LoadingDialogState | null;
  onCancel: () => void;
  onContinue: (suppressFuture: boolean) => void;
}

const ItemBatchLoadingDialog: React.FC<ItemBatchLoadingDialogProps> = ({
  open,
  state,
  onCancel,
  onContinue,
}) => {
  const [suppressWarning, setSuppressWarning] = useState(false);

  if (!state) return null;

  const {
    cacheLoading,
    cacheProgress,
    totalCount,
    showLargeDatasetWarning,
    rowCount,
    mode,
  } = state;

  // Determine which scenario we're in
  const isScenarioA = !cacheLoading && showLargeDatasetWarning; // Warning only
  const isScenarioB = cacheLoading && !showLargeDatasetWarning; // Loading only
  const isScenarioAB = cacheLoading && showLargeDatasetWarning; // Both

  const handleContinue = () => {
    onContinue(suppressWarning);
    setSuppressWarning(false);
  };

  const handleCancel = () => {
    onCancel();
    setSuppressWarning(false);
  };

  // Scenario A: Warning Only (Cache Ready, Large Dataset)
  if (isScenarioA) {
    return (
      <Dialog
        open={open}
        onClose={handleCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Load All Items?
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            You are about to load {rowCount.toLocaleString()} items into the batch editor. 
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Consider:
            </Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 3 }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Applying advanced filters
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Selecting specific items with checkboxes
                </Typography>
              </li>
            </Box>
          </Box>

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
  }

  // Scenario B: Loading Only (Cache Not Ready, Any Dataset Size)
  if (isScenarioB) {
    return (
      <Dialog
        open={open}
        onClose={handleCancel}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DataIcon color="primary" />
          Preparing Data...
        </DialogTitle>
        
        <DialogContent>
          <Box 
            sx={{ 
              p: 2, 
              bgcolor: 'info.light', 
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.primary">
              Loading item data, please wait...
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCancel} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Scenario A+B: Loading + Warning (Cache Not Ready, Large Dataset)
  // Note: When cache finishes loading, ItemsList.tsx should update the dialog state
  // to transition from Scenario A+B to Scenario A by setting cacheLoading: false
  if (isScenarioAB) {
    return (
      <Dialog
        open={open}
        onClose={handleCancel}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Load All Items?
        </DialogTitle>
        
        <DialogContent>
          {/* Loading message - shows while cache is loading */}
          <Box 
            sx={{ 
              mb: 3, 
              p: 2, 
              bgcolor: 'info.light', 
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.primary">
              Loading item data, please wait...
            </Typography>
          </Box>

          {/* Warning message - always visible */}
          <Typography variant="body1" gutterBottom>
            You are about to load {rowCount.toLocaleString()} items into the batch editor.
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Consider:
            </Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 3 }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Applying advanced filters
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Selecting specific items with checkboxes
                </Typography>
              </li>
            </Box>
          </Box>

          {/* Suppress warning checkbox */}
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
          <Button 
            onClick={handleContinue} 
            variant="contained" 
            color="primary"
            disabled
          >
            Continue Anyway
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Should never reach here
  return null;
};

export default ItemBatchLoadingDialog;

