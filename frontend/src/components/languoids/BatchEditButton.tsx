import React, { useState, useRef } from 'react';
import {
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  ListItemText,
  Typography,
  Box,
} from '@mui/material';
import {
  ArrowDropDown as ArrowDropDownIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

export type BatchEditMode = 'filtered' | 'selected' | 'empty';

interface BatchEditButtonProps {
  mode: BatchEditMode;
  onModeChange: (mode: BatchEditMode) => void;
  onExecute: (mode: BatchEditMode) => void;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  disabled?: boolean;
}

const BatchEditButton: React.FC<BatchEditButtonProps> = ({
  mode,
  onModeChange,
  onExecute,
  selectedCount,
  filteredCount,
  totalCount,
  disabled = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Get button label based on mode
  const getButtonLabel = (currentMode: BatchEditMode): string => {
    switch (currentMode) {
      case 'filtered':
        return 'Batch Edit Filtered Results';
      case 'selected':
        return 'Batch Edit Selected';
      case 'empty':
        return 'Batch Edit (Empty)';
    }
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
    localStorage.setItem('languoid-batch-edit-mode', selectedMode);
    onModeChange(selectedMode);
    
    // Execute immediately after mode change
    onExecute(selectedMode);
  };

  return (
    <>
      <ButtonGroup
        variant="contained"
        ref={anchorRef}
        disabled={disabled}
        sx={{ boxShadow: 2 }}
      >
        {/* Main button - executes current mode */}
        <Button
          startIcon={<EditIcon />}
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
                {filteredCount} languoid{filteredCount !== 1 ? 's' : ''}
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
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : 'None selected'}
              </Typography>
            }
          />
        </MenuItem>

        {/* Option 3: Batch Edit (Empty) */}
        <MenuItem
          onClick={() => handleMenuItemClick('empty')}
          selected={mode === 'empty'}
        >
          <ListItemText
            primary="Batch Edit (Empty)"
            secondary={
              <Typography variant="caption" color="text.secondary">
                Start with empty grid
              </Typography>
            }
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default BatchEditButton;

