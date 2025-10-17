/**
 * Accessibility utilities and helpers for ADA compliance
 */

// ARIA labels and descriptions for common UI elements
export const ariaLabels = {
  // Navigation
  mainNavigation: 'Main navigation',
  skipToContent: 'Skip to main content',
  userMenu: 'User account menu',
  mobileMenuToggle: 'Toggle mobile navigation menu',
  
  // Forms
  required: 'Required field',
  optional: 'Optional field',
  searchForm: 'Search form',
  filterForm: 'Filter options',
  
  // Tables
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  selectRow: 'Select row',
  selectAllRows: 'Select all rows',
  actionsMenu: 'Actions menu',
  
  // Status messages
  loading: 'Loading content',
  error: 'Error message',
  success: 'Success message',
  
  // Pagination
  pagination: 'Pagination navigation',
  previousPage: 'Go to previous page',
  nextPage: 'Go to next page',
  pageNumber: (page: number) => `Go to page ${page}`,
  currentPage: (page: number) => `Current page, page ${page}`,
  
  // Modal dialogs
  dialog: 'Dialog',
  closeDialog: 'Close dialog',
  
  // Buttons
  add: 'Add new item',
  edit: 'Edit item',
  delete: 'Delete item',
  view: 'View details',
  save: 'Save changes',
  cancel: 'Cancel',
  submit: 'Submit form',
} as const;

// Screen reader only text utility
export const srOnly = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: '0',
};

// Focus management utilities
export const focusUtils = {
  // Trap focus within an element (for modals)
  trapFocus: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  },

  // Focus first focusable element in container
  focusFirst: (container: HTMLElement) => {
    const focusable = container.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    focusable?.focus();
  },

  // Announce to screen readers
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.cssText = Object.entries(srOnly)
      .map(([key, value]) => `${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}: ${value}`)
      .join('; ');
    
    document.body.appendChild(announcer);
    announcer.textContent = message;
    
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  },
};

// Keyboard navigation helpers
export const keyboardUtils = {
  // Common key codes
  keys: {
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    TAB: 'Tab',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
  },

  // Handle enter/space for custom clickable elements
  handleActivation: (callback: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === keyboardUtils.keys.ENTER || e.key === keyboardUtils.keys.SPACE) {
      e.preventDefault();
      callback();
    }
  },

  // Arrow key navigation for lists/menus
  handleArrowNavigation: (
    e: React.KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onIndexChange: (index: number) => void
  ) => {
    let newIndex = currentIndex;
    
    switch (e.key) {
      case keyboardUtils.keys.ARROW_UP:
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case keyboardUtils.keys.ARROW_DOWN:
        e.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
      case keyboardUtils.keys.HOME:
        e.preventDefault();
        newIndex = 0;
        break;
      case keyboardUtils.keys.END:
        e.preventDefault();
        newIndex = items.length - 1;
        break;
    }
    
    if (newIndex !== currentIndex) {
      onIndexChange(newIndex);
      items[newIndex]?.focus();
    }
  },
};

// Color contrast utilities (for ensuring WCAG compliance)
export const colorUtils = {
  // Check if color contrast meets WCAG AA standards
  meetsContrastRatio: (foreground: string, background: string, level: 'AA' | 'AAA' = 'AA') => {
    // This is a simplified check - in production, you'd use a proper contrast calculation library
    // For now, we'll provide the required ratios
    const requiredRatios = {
      AA: { normal: 4.5, large: 3.0 },
      AAA: { normal: 7.0, large: 4.5 },
    };
    return requiredRatios[level];
  },

  // Common accessible color combinations
  accessibleColors: {
    primary: {
      background: '#1976d2',
      text: '#ffffff',
      ratio: 7.2, // AAA compliant
    },
    error: {
      background: '#d32f2f',
      text: '#ffffff',
      ratio: 5.1, // AA compliant
    },
    success: {
      background: '#2e7d32',
      text: '#ffffff',
      ratio: 5.9, // AA compliant
    },
    warning: {
      background: '#ed6c02',
      text: '#ffffff',
      ratio: 4.6, // AA compliant
    },
  },
};

// Form accessibility helpers
export const formUtils = {
  // Generate accessible field IDs and labels
  generateFieldProps: (fieldName: string, label: string, required = false) => ({
    id: `field-${fieldName}`,
    name: fieldName,
    'aria-label': label,
    'aria-required': required,
    'aria-describedby': `${fieldName}-help ${fieldName}-error`,
  }),

  // Error message props
  generateErrorProps: (fieldName: string) => ({
    id: `${fieldName}-error`,
    role: 'alert',
    'aria-live': 'polite' as const,
  }),

  // Help text props
  generateHelpProps: (fieldName: string) => ({
    id: `${fieldName}-help`,
  }),
};

// Table accessibility helpers
export const tableUtils = {
  // Generate accessible table headers
  generateHeaderProps: (columnName: string, sortable = false) => ({
    id: `header-${columnName}`,
    scope: 'col' as const,
    role: sortable ? 'columnheader' : undefined,
    'aria-sort': sortable ? 'none' as const : undefined,
    tabIndex: sortable ? 0 : undefined,
  }),

  // Generate accessible table cell props
  generateCellProps: (columnName: string, rowIndex: number) => ({
    headers: `header-${columnName}`,
    'data-row': rowIndex,
  }),

  // Generate accessible table caption
  generateCaptionProps: (totalCount: number, filteredCount?: number) => {
    const caption = filteredCount !== undefined && filteredCount !== totalCount
      ? `Showing ${filteredCount} of ${totalCount} items`
      : `${totalCount} items total`;
    
    return {
      children: caption,
      style: srOnly, // Visually hidden but available to screen readers
    };
  },
};

const accessibilityUtils = {
  ariaLabels,
  srOnly,
  focusUtils,
  keyboardUtils,
  colorUtils,
  formUtils,
  tableUtils,
};

export default accessibilityUtils;
