import { ChipProps } from '@mui/material/Chip';
import { SxProps, Theme } from '@mui/material/styles';

export type AccessLevelChipProps = Pick<ChipProps, 'color'> & {
  sx?: SxProps<Theme>;
};

export function getAccessLevelChipProps(
  accessLevel: string | null | undefined
): AccessLevelChipProps {
  switch (accessLevel) {
    case '1':
      return { color: 'success' };
    case '2':
      return { color: 'info' };
    case '3':
      return { color: 'warning' };
    case '4':
      return {
        sx: {
          bgcolor: '#fdd835',
          color: 'rgba(0, 0, 0, 0.87)',
        },
      };
    default:
      return { color: 'default' };
  }
}
