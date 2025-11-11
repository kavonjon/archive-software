import React, { useState, useRef } from 'react';
import {
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  ListItemText,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  ArrowDropDown as ArrowDropDownIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

export type BatchEditMode = 'filtered' | 'selected';

interface CollaboratorBatchEditButtonProps {
  mode: BatchEditMode;
  onModeChange: (mode: BatchEditMode) => void;
  onExecute: (mode: BatchEditMode) => void;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  disabled?: boolean;
  cacheLoading?: boolean;
  cacheProgress?: number; // 0-100
}

const CollaboratorBatchEditButton: React.FC<CollaboratorBatchEditButtonProps> = ({
  mode,
  onModeChange,
  onExecute,
  selectedCount,
  filteredCount,
  totalCount,
  disabled = false,
  cacheLoading = false,
  cacheProgress = 0,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Get button label based on mode and cache status
  const getButtonLabel = (currentMode: BatchEditMode): string => {
    const baseLabel = currentMode === 'filtered' 
      ? 'Batch Edit Filtered Results'
      : 'Batch Edit Selected';
    
    if (cacheLoading && cacheProgress < 100) {
      return `${baseLabel} (loading...)`;
    }
    
    return baseLabel;
  };

  // Get tooltip text for cache loading state
  const getTooltipText = (): string | null => {
    if (cacheLoading && cacheProgress < 100) {
      return `Loading collaborator data: ${Math.round(cacheProgress)}%`;
    }
    return null;
  };

  // Check if main button should be disabled
  const isMainButtonDisabled = mode === 'selected' && selectedCount === 0;

  // Handle main button click (execute current mode)
  const handleMainButtonClick = () => {
    if (!isMainButtonDisabled) {
      onExecute(mode);
    }
  };

  // Handle caret button click (open dropdown)
  const handleCaretClick = () => {
    setMenuOpen(true);
  };

  // Handle menu item click
  const handleMenuItemClick = (selectedMode: BatchEditMode) => {
    setMenuOpen(false);
    
    // Update mode in localStorage
    localStorage.setItem('collaborator-batch-edit-mode', selectedMode);
    onModeChange(selectedMode);
    
    // Execute immediately after mode change
    onExecute(selectedMode);
  };

  return (
    <>
      <Tooltip title={getTooltipText() || ''} disableHoverListener={!cacheLoading || cacheProgress >= 100}>
        <ButtonGroup
          variant="contained"
          ref={anchorRef}
          disabled={disabled}
          sx={{ boxShadow: 2 }}
        >
          {/* Main button - executes current mode */}
          <Button
            startIcon={cacheLoading && cacheProgress < 100 ? <CircularProgress size={16} color="inherit" /> : <EditIcon />}
            onClick={handleMainButtonClick}
            disabled={disabled || isMainButtonDisabled}
            sx={{
              minWidth: 220,
              textTransform: 'none',
            }}
          >
            {getButtonLabel(mode)}
          </Button>
          
          {/* Caret button - opens dropdown (always enabled) */}
          <Button
            size="small"
            onClick={handleCaretClick}
            disabled={disabled}
            sx={{
              px: 0.5,
            }}
          >
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>
      </Tooltip>

      {/* Dropdown menu */}
      <Menu
        open={menuOpen}
        anchorEl={anchorRef.current}
        onClose={() => setMenuOpen(false)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {/* Option 1: Batch Edit Filtered Results */}
        <MenuItem
          onClick={() => handleMenuItemClick('filtered')}
          selected={mode === 'filtered'}
        >
          <ListItemText
            primary="Batch Edit Filtered Results"
            secondary={
              <Typography variant="caption" color="text.secondary">
                {filteredCount} collaborator{filteredCount !== 1 ? 's' : ''}
              </Typography>
            }
          />
        </MenuItem>

        {/* Option 2: Batch Edit Selected */}
        <MenuItem
          onClick={() => handleMenuItemClick('selected')}
          selected={mode === 'selected'}
          disabled={selectedCount === 0}
        >
          <ListItemText
            primary="Batch Edit Selected"
            secondary={
              <Typography variant="caption" color="text.secondary">
                {selectedCount} collaborator{selectedCount !== 1 ? 's' : ''} selected
              </Typography>
            }
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default CollaboratorBatchEditButton;

