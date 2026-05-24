import React, { useId, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { touchTargets } from '../../utils/responsive';

interface ColumnOption<T extends string> {
  id: T;
  label: string;
  group?: string;
}

interface ColumnVisibilityMenuProps<T extends string> {
  columns: ColumnOption<T>[];
  groupOrder?: readonly string[];
  visibleColumnIds: Set<T>;
  onToggle: (columnId: T) => void;
  onReset: () => void;
  onChange?: (columnId: T, visible: boolean) => void;
}

function ColumnVisibilityMenu<T extends string>({
  columns,
  groupOrder = [],
  visibleColumnIds,
  onToggle,
  onReset,
  onChange,
}: ColumnVisibilityMenuProps<T>) {
  const menuId = useId();
  const buttonId = `${menuId}-button`;
  const headingId = `${menuId}-heading`;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const groupedColumns = useMemo(() => {
    const groups = new Map<string, ColumnOption<T>[]>();

    columns.forEach((column) => {
      const groupName = column.group ?? 'Other';
      const existing = groups.get(groupName) ?? [];
      existing.push(column);
      groups.set(groupName, existing);
    });

    const detailOrder = columns.reduce<Map<string, number>>((orderMap, column, index) => {
      orderMap.set(column.id, index);
      return orderMap;
    }, new Map());

    const orderedGroupNames = [
      ...groupOrder.filter((groupName) => groups.has(groupName)),
      ...Array.from(groups.keys()).filter((groupName) => !groupOrder.includes(groupName)),
    ];

    return orderedGroupNames.map((groupName) => ({
      groupName,
      columns: (groups.get(groupName) ?? []).slice().sort((left, right) => {
        const leftOrder = detailOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = detailOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      }),
    }));
  }, [columns, groupOrder]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggle = (columnId: T) => {
    const willBeVisible = !visibleColumnIds.has(columnId);
    onToggle(columnId);
    onChange?.(columnId, willBeVisible);
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <>
      <Tooltip title="Customize columns">
        <IconButton
          id={buttonId}
          size="small"
          onClick={handleOpen}
          aria-label="Customize visible columns"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          sx={{ minWidth: touchTargets.minSize, minHeight: touchTargets.minSize }}
        >
          <MenuIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        id={menuId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        aria-labelledby={headingId}
      >
        <Box
          sx={{
            minWidth: 280,
            maxWidth: 360,
            maxHeight: 420,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              borderBottom: 1,
              borderColor: 'divider',
              flexShrink: 0,
              bgcolor: 'background.paper',
            }}
          >
            <Typography id={headingId} variant="subtitle2" component="h2">
              Columns
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={handleReset}
              sx={{
                minHeight: touchTargets.minSize,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Reset to default
            </Button>
          </Box>

          <Box
            role="group"
            aria-label="Column visibility options"
            sx={{
              overflowY: 'auto',
              py: 1,
              flex: 1,
            }}
          >
            {groupedColumns.map(({ groupName, columns: groupColumns }) => (
              <Box key={groupName} sx={{ mb: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 2, pt: 0.5, pb: 0.25, display: 'block', fontWeight: 600 }}
                >
                  {groupName}
                </Typography>
                {groupColumns.map((column) => (
                  <Box key={column.id} sx={{ px: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={visibleColumnIds.has(column.id)}
                          onChange={() => handleToggle(column.id)}
                          size="small"
                        />
                      }
                      label={column.label}
                      sx={{ mx: 0, width: '100%' }}
                    />
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  );
}

export default ColumnVisibilityMenu;
