/**
 * Permission utility functions that mirror backend permission logic
 */

import { User } from '../contexts/AuthContext';

/**
 * Check if user has view access (can see pages and read data)
 * 
 * Users must be in one of the three groups OR be staff/superuser:
 * - Administrators (is_staff=True or is_superuser=True)
 * - Archivist group
 * - Museum Staff group  
 * - Read-Only group
 */
export const hasViewAccess = (user: User | null): boolean => {
  if (!user) return false;
  
  // Staff/superuser always have access
  if (user.is_staff || user.is_superuser) return true;
  
  // Must be in one of the three groups
  return user.groups.some(group => 
    group === 'Archivist' || group === 'Museum Staff' || group === 'Read-Only'
  );
};

/**
 * Check if user has edit access (matches backend IsAuthenticatedWithEditAccess logic)
 * 
 * Backend logic:
 * - Staff users (is_staff=True) OR
 * - Users in 'Archivist' or 'Museum Staff' groups
 * 
 * This allows Museum Staff (is_staff=False) to edit via React app while blocking Django admin access.
 */
export const hasEditAccess = (user: User | null): boolean => {
  if (!user) return false;
  
  // Staff users OR users in Archivist/Museum Staff groups have edit access
  return user.is_staff || 
         user.groups.some(group => group === 'Archivist' || group === 'Museum Staff');
};

/**
 * Check if user has delete access (typically requires Archivist role)
 * Only Archivist group or Admins (superuser) can delete - more restrictive than edit access
 */
export const hasDeleteAccess = (user: User | null): boolean => {
  if (!user) return false;
  
  return user.is_superuser || user.groups.includes('Archivist');
};

/**
 * Check if user has Django admin access
 */
export const hasAdminAccess = (user: User | null): boolean => {
  if (!user) return false;
  return user.is_staff;
};

/**
 * Get user's role name for display purposes
 */
export const getUserRole = (user: User | null): string => {
  if (!user) return 'Guest';
  
  if (user.is_superuser) return 'Administrator';
  
  if (user.is_staff && user.groups?.includes('Archivist')) {
    return 'Archivist';
  }
  
  if (user.groups?.includes('Museum Staff')) {
    return 'Museum Staff';
  }
  
  if (user.is_staff) {
    return 'Staff';
  }
  
  return 'Read-Only';
};
