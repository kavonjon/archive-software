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

interface CollectionExportButtonProps {
  mode: ExportMode;
  exportStatus: ExportStatus;
  onModeChange: (mode: ExportMode) => void;
  onExecute: (mode: ExportMode) => void;
  selectedCount: number;
  filteredCount: number;
  disabled?: boolean;
}

const CollectionExportButton: React.FC<CollectionExportButtonProps> = ({
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

  const getButtonLabel = (): string => {
    if (exportStatus === 'preparing') {
      return 'Preparing download...';
    }
    if (exportStatus === 'ready') {
      return 'Download ready';
    }

    switch (mode) {
      case 'filtered':
        return 'Export Filtered Results';
      case 'selected':
        return 'Export Selected';
    }
  };

  const getButtonIcon = () => {
    if (exportStatus === 'preparing') {
      return <CircularProgress size={20} sx={{ color: 'inherit' }} />;
    }
    if (exportStatus === 'ready') {
      return <CheckCircleIcon />;
    }
    return <DownloadIcon />;
  };

  const isMainButtonDisabled =
    exportStatus === 'idle' && mode === 'selected' && selectedCount === 0;

  const isDropdownDisabled = exportStatus !== 'idle';

  const handleMainButtonClick = () => {
    if (!isMainButtonDisabled && exportStatus !== 'preparing') {
      onExecute(mode);
    }
  };

  const handleCaretClick = () => {
    if (!isDropdownDisabled) {
      setMenuOpen(true);
    }
  };

  const handleMenuItemClick = (selectedMode: ExportMode) => {
    setMenuOpen(false);
    localStorage.setItem('collection-export-mode', selectedMode);
    onModeChange(selectedMode);
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
        <Button
          size="small"
          onClick={handleCaretClick}
          disabled={disabled || isDropdownDisabled}
          sx={{ px: 0.5 }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>

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
        <MenuItem
          onClick={() => handleMenuItemClick('filtered')}
          selected={mode === 'filtered'}
        >
          <ListItemText
            primary="Export Filtered Results"
            secondary={
              <Typography variant="caption" color="text.secondary">
                {filteredCount} collection{filteredCount !== 1 ? 's' : ''}
              </Typography>
            }
          />
        </MenuItem>

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

export default CollectionExportButton;
