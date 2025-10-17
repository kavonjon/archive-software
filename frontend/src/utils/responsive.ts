/**
 * Responsive design utilities and breakpoints
 * Mobile-first approach following Material-UI conventions
 */

// Breakpoint values (mobile-first)
export const breakpoints = {
  xs: 0,     // Extra small devices (phones)
  sm: 600,   // Small devices (large phones, small tablets)
  md: 900,   // Medium devices (tablets)
  lg: 1200,  // Large devices (desktops)
  xl: 1536,  // Extra large devices (large desktops)
} as const;

// Media query helpers for styled components or inline styles
export const mediaQueries = {
  up: (breakpoint: keyof typeof breakpoints) => 
    `@media (min-width: ${breakpoints[breakpoint]}px)`,
  down: (breakpoint: keyof typeof breakpoints) => 
    `@media (max-width: ${breakpoints[breakpoint] - 1}px)`,
  between: (start: keyof typeof breakpoints, end: keyof typeof breakpoints) =>
    `@media (min-width: ${breakpoints[start]}px) and (max-width: ${breakpoints[end] - 1}px)`,
  only: (breakpoint: keyof typeof breakpoints) => {
    const keys = Object.keys(breakpoints) as (keyof typeof breakpoints)[];
    const index = keys.indexOf(breakpoint);
    if (index === keys.length - 1) {
      // Last breakpoint, no upper limit
      return `@media (min-width: ${breakpoints[breakpoint]}px)`;
    }
    const nextBreakpoint = keys[index + 1];
    return `@media (min-width: ${breakpoints[breakpoint]}px) and (max-width: ${breakpoints[nextBreakpoint] - 1}px)`;
  },
};

// Common responsive spacing values
export const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  xxl: '3rem',    // 48px
} as const;

// Touch-friendly sizing (minimum 44px for tap targets)
export const touchTargets = {
  minSize: '44px',
  comfortable: '48px',
  large: '56px',
} as const;

// Common responsive grid configurations
export const gridConfigs = {
  // Auto-fit columns with minimum width
  autoFit: (minWidth: string) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
    gap: spacing.md,
  }),
  
  // Responsive columns based on screen size
  responsive: {
    xs: { gridTemplateColumns: '1fr' },
    sm: { gridTemplateColumns: 'repeat(2, 1fr)' },
    md: { gridTemplateColumns: 'repeat(3, 1fr)' },
    lg: { gridTemplateColumns: 'repeat(4, 1fr)' },
  },
  
  // Form layouts
  form: {
    singleColumn: { gridTemplateColumns: '1fr' },
    twoColumn: { gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' },
    threeColumn: { gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' },
  },
};

// Utility function to check if current screen size matches breakpoint
export const useResponsive = () => {
  // This would typically use a hook like useMediaQuery from Material-UI
  // For now, we'll provide the breakpoint values for use with Material-UI's useMediaQuery
  return {
    breakpoints,
    mediaQueries,
    spacing,
    touchTargets,
    gridConfigs,
  };
};

// Common responsive patterns
export const responsivePatterns = {
  // Stack items vertically on mobile, horizontally on larger screens
  stackToRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing.md,
    [mediaQueries.up('sm')]: {
      flexDirection: 'row' as const,
    },
  },
  
  // Hide on mobile, show on larger screens
  hideOnMobile: {
    display: 'none',
    [mediaQueries.up('sm')]: {
      display: 'block',
    },
  },
  
  // Show only on mobile
  showOnlyMobile: {
    display: 'block',
    [mediaQueries.up('sm')]: {
      display: 'none',
    },
  },
  
  // Full width on mobile, constrained on larger screens
  responsiveWidth: {
    width: '100%',
    [mediaQueries.up('md')]: {
      maxWidth: '1200px',
      margin: '0 auto',
    },
  },
  
  // Responsive padding
  responsivePadding: {
    padding: spacing.md,
    [mediaQueries.up('sm')]: {
      padding: spacing.lg,
    },
    [mediaQueries.up('md')]: {
      padding: spacing.xl,
    },
  },
};

const responsiveUtils = {
  breakpoints,
  mediaQueries,
  spacing,
  touchTargets,
  gridConfigs,
  responsivePatterns,
  useResponsive,
};

export default responsiveUtils;
