/**
 * Export Button Component for Collaborator List
 * 
 * Split button with dropdown for exporting collaborators to Excel:
 * - Export Filtered Results
 * - Export Selected
 * 
 * Last-pressed option becomes the main button action (persisted in localStorage)
 */

import React, { useState, useRef } from 'react';
import {
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  ListItemText,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  ArrowDropDown as ArrowDropDownIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

export type ExportMode = 'filtered' | 'selected';
export type ExportStatus = 'idle' | 'preparing' | 'ready';

interface CollaboratorExportButtonProps {
  mode: ExportMode;
  exportStatus: ExportStatus;
  onModeChange: (mode: ExportMode) => void;
  onExecute: (mode: ExportMode) => void;
  selectedCount: number;
  filteredCount: number;
  disabled?: boolean;
}

const CollaboratorExportButton: React.FC<CollaboratorExportButtonProps> = ({
  mode,
  exportStatus,
  onModeChange,
  onExecute,
  selectedCount,
  filteredCount,
  disabled = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Get button label based on status and mode
  const getButtonLabel = (): string => {
    if (exportStatus === 'preparing') {
      return 'Preparing download...';
    }
    if (exportStatus === 'ready') {
      return 'Download ready';
    }
    
    // Idle state - show mode
    switch (mode) {
      case 'filtered':
        return 'Export Filtered Results';
      case 'selected':
        return 'Export Selected';
    }
  };
  
  // Get button icon based on status
  const getButtonIcon = () => {
    if (exportStatus === 'preparing') {
      return <CircularProgress size={20} sx={{ color: 'inherit' }} />;
    }
    if (exportStatus === 'ready') {
      return <CheckCircleIcon />;
    }
    return <DownloadIcon />;
  };

  // Check if main button should be disabled
  const isMainButtonDisabled = 
    exportStatus === 'idle' && mode === 'selected' && selectedCount === 0;
  
  // Disable dropdown during preparing state
  const isDropdownDisabled = exportStatus !== 'idle';

  // Handle main button click (execute current mode or download ready file)
  const handleMainButtonClick = () => {
    if (!isMainButtonDisabled && exportStatus !== 'preparing') {
      onExecute(mode);
    }
  };

  // Handle caret button click (open dropdown)
  const handleCaretClick = () => {
    if (!isDropdownDisabled) {
      setMenuOpen(true);
    }
  };

  // Handle menu item click
  const handleMenuItemClick = (selectedMode: ExportMode) => {
    setMenuOpen(false);
    
    // Update mode in localStorage
    localStorage.setItem('collaborator-export-mode', selectedMode);
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
        {/* Main button - executes current mode or downloads ready file */}
        <Button
          startIcon={getButtonIcon()}
          onClick={handleMainButtonClick}
          disabled={disabled || isMainButtonDisabled || exportStatus === 'preparing'}
          sx={{
            minWidth: 220,
            textTransform: 'none',
          }}
        >
          {getButtonLabel()}
        </Button>
        
        {/* Caret button - opens dropdown (disabled during preparing) */}
        <Button
          size="small"
          onClick={handleCaretClick}
          disabled={disabled || isDropdownDisabled}
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
        {/* Option 1: Export Filtered Results */}
        <MenuItem
          onClick={() => handleMenuItemClick('filtered')}
          selected={mode === 'filtered'}
        >
          <ListItemText
            primary="Export Filtered Results"
            secondary={
              <Typography variant="caption" color="text.secondary">
                {filteredCount} collaborator{filteredCount !== 1 ? 's' : ''}
              </Typography>
            }
          />
        </MenuItem>

        {/* Option 2: Export Selected */}
        <MenuItem
          onClick={() => handleMenuItemClick('selected')}
          selected={mode === 'selected'}
          disabled={selectedCount === 0}
        >
          <ListItemText
            primary="Export Selected"
            secondary={
              <Typography variant="caption" color="text.secondary">
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : 'None selected'}
              </Typography>
            }
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default CollaboratorExportButton;

