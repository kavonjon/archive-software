import React from 'react';
import { Box, Chip, Link, TableCell, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { Item, ROLE_CHOICES } from '../../services/api';
import { tableUtils } from '../../utils/accessibility';
import { getAccessLevelChipProps } from '../../utils/accessLevelChip';

export const EMPTY_CELL = '—';

export const truncatedChipSx = {
  maxWidth: 240,
  '& .MuiChip-label': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
} as const;

export const truncatedTextSx = {
  maxWidth: truncatedChipSx.maxWidth,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

export function formatCellText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return EMPTY_CELL;
  }
  if (typeof value === 'string' && !value.trim()) {
    return EMPTY_CELL;
  }
  return String(value);
}

export function formatRoleLabels(roles: string[]): string {
  if (!roles.length) {
    return '';
  }

  const roleLabels = roles.map((role) => {
    const choice = ROLE_CHOICES.find((entry) => entry.value === role);
    return choice?.label ?? role;
  });

  return roleLabels.join(', ');
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_CELL;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

interface CellWrapperProps {
  columnId: string;
  rowIndex: number;
  children: React.ReactNode;
}

export function CellWrapper({ columnId, rowIndex, children }: CellWrapperProps) {
  return (
    <TableCell {...tableUtils.generateCellProps(columnId, rowIndex)}>
      {children}
    </TableCell>
  );
}

export function PlainTextCell({
  columnId,
  rowIndex,
  value,
  truncate = false,
}: {
  columnId: string;
  rowIndex: number;
  value: string | number | null | undefined;
  truncate?: boolean;
}) {
  const text = formatCellText(value);

  return (
    <CellWrapper columnId={columnId} rowIndex={rowIndex}>
      <Typography
        variant="body2"
        color={text === EMPTY_CELL ? 'text.secondary' : 'text.primary'}
        sx={truncate ? truncatedTextSx : undefined}
        title={truncate && text !== EMPTY_CELL ? text : undefined}
      >
        {text}
      </Typography>
    </CellWrapper>
  );
}

export function ChipListCell({
  columnId,
  rowIndex,
  values,
}: {
  columnId: string;
  rowIndex: number;
  values: string[] | null | undefined;
}) {
  const items = values?.filter(Boolean) ?? [];

  return (
    <CellWrapper columnId={columnId} rowIndex={rowIndex}>
      {items.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {items.map((value, index) => (
            <Chip key={`${value}-${index}`} label={value} size="small" />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {EMPTY_CELL}
        </Typography>
      )}
    </CellWrapper>
  );
}

export function CatalogCell({ item, rowIndex }: { item: Item; rowIndex: number }) {
  return (
    <CellWrapper columnId="catalog" rowIndex={rowIndex}>
      <Link
        component={RouterLink}
        to={`/items/${item.id}`}
        onClick={(event) => event.stopPropagation()}
        variant="body2"
        sx={{
          fontWeight: 'medium',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {item.catalog_number}
      </Link>
    </CellWrapper>
  );
}

export function TitlesCell({ item, rowIndex }: { item: Item; rowIndex: number }) {
  return (
    <CellWrapper columnId="title" rowIndex={rowIndex}>
      {item.titles && item.titles.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {item.titles.map((title, titleIndex) => (
            <Box
              key={titleIndex}
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}
            >
              {title.default && (
                <Chip label="Primary" size="small" color="primary" variant="outlined" />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: title.default ? 'medium' : 'normal',
                  fontStyle: title.default ? 'normal' : 'italic',
                }}
              >
                {title.title}
                {title.language_name && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}({title.language_name})
                  </Typography>
                )}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No title
        </Typography>
      )}
    </CellWrapper>
  );
}

export function CollaboratorsCell({ item, rowIndex }: { item: Item; rowIndex: number }) {
  const collaborators = item.collaborators ?? [];

  return (
    <CellWrapper columnId="collaborators" rowIndex={rowIndex}>
      {collaborators.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {collaborators.slice(0, 2).map((collaborator) => {
            const rolesLabel = formatRoleLabels(collaborator.roles);

            return (
              <Box key={collaborator.id}>
                <Typography variant="body2">{collaborator.name}</Typography>
                {rolesLabel && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {rolesLabel}
                  </Typography>
                )}
              </Box>
            );
          })}
          {collaborators.length > 2 && (
            <Typography variant="caption" color="text.secondary">
              +{collaborators.length - 2} more
            </Typography>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {EMPTY_CELL}
        </Typography>
      )}
    </CellWrapper>
  );
}

export function AccessLevelCell({ item, rowIndex }: { item: Item; rowIndex: number }) {
  const label = item.item_access_level_display || 'Unknown';
  const chipProps = getAccessLevelChipProps(item.item_access_level);

  return (
    <CellWrapper columnId="access" rowIndex={rowIndex}>
      <Chip
        label={label}
        size="small"
        color={chipProps.color}
        sx={[truncatedChipSx, chipProps.sx].filter(Boolean) as SxProps<Theme>}
        title={label}
      />
    </CellWrapper>
  );
}

export function ResourceTypeCell({ item, rowIndex }: { item: Item; rowIndex: number }) {
  return (
    <CellWrapper columnId="type" rowIndex={rowIndex}>
      <Chip
        label={item.resource_type_display || 'Unknown'}
        size="small"
        variant="outlined"
      />
    </CellWrapper>
  );
}

export function LanguagesCell({ item, rowIndex }: { item: Item; rowIndex: number }) {
  return (
    <ChipListCell
      columnId="languages"
      rowIndex={rowIndex}
      values={item.language_names}
    />
  );
}
