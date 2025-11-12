import { useEffect } from 'react';

/**
 * Custom hook to set the page title dynamically.
 * 
 * @param title - The page-specific title (e.g., "Items", "Collections")
 * 
 * @example
 * usePageTitle('Items'); // Sets title to "NAL Archive | Items"
 * usePageTitle('Item Details'); // Sets title to "NAL Archive | Item Details"
 */
export const usePageTitle = (title: string): void => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `NAL Archive | ${title}`;

    // Cleanup: restore previous title when component unmounts
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
};

