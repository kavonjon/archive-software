export function formatCollaboratorRolesChipLabel(
  displayName: string,
  roleDisplay: string[],
): string {
  const roleLabels = roleDisplay.join(', ');
  return roleLabels ? `${displayName} (${roleLabels})` : displayName;
}

export const collaboratorRoleChipSx = {
  maxWidth: '100%',
  height: 'auto',
  '& .MuiChip-label': {
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    lineHeight: 1.4,
    padding: '4px 8px',
    maxWidth: '100%',
  },
} as const;
