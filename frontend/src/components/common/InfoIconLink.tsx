import { IconButton, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

export interface InfoIconLinkProps {
  /**
   * The section anchor in the user guide (e.g., 'batch-editor', 'importing-data')
   */
  anchor: string;
  /**
   * Optional tooltip text. Defaults to "Learn more"
   */
  tooltip?: string;
  /**
   * Optional size. Defaults to "small"
   */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Info icon that links to a specific section of the user guide.
 * Opens in a new tab to avoid disrupting the user's workflow.
 * 
 * Usage:
 * ```tsx
 * <InfoIconLink anchor="batch-editor" tooltip="Learn about batch editing" />
 * <InfoIconLink anchor="importing-data" />
 * ```
 */
export const InfoIconLink = ({ anchor, tooltip = 'Learn more', size = 'small' }: InfoIconLinkProps) => {
  const url = `/user-guide#${anchor}`;

  return (
    <Tooltip title={tooltip} arrow>
      <IconButton
        size={size}
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          color: 'info.main',
          '&:hover': {
            color: 'info.dark',
          }
        }}
        aria-label={tooltip}
      >
        <InfoIcon fontSize={size} />
      </IconButton>
    </Tooltip>
  );
};

