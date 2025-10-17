import { User } from '../contexts/AuthContext';

/**
 * Permission utilities for checking user authorization
 * Mirrors the backend IsAuthenticatedWithEditAccess permission logic
 */

export const hasEditAccess = (user: User | null): boolean => {
  if (!user) return false;
  
  // Staff users OR users in Archivist/Museum Staff groups have edit access
  return user.is_staff || user.groups.some(group => 
    ['Archivist', 'Museum Staff'].includes(group)
  );
};

export const hasDeleteAccess = (user: User | null): boolean => {
  if (!user) return false;
  
  // Only Archivist group or Admins (superuser) can delete
  // This is more restrictive than edit access
  return user.is_superuser || user.groups.includes('Archivist');
};

export const getUserRole = (user: User | null): string => {
  if (!user) return 'Not authenticated';
  
  if (user.is_superuser) return 'Administrator';
  if (user.is_staff && user.groups.includes('Archivist')) return 'Archivist';
  if (user.groups.includes('Museum Staff')) return 'Museum Staff';
  if (user.is_staff) return 'Staff (no group)';
  return 'Read-Only';
};
