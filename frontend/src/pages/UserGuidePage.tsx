import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Box, Typography, List, ListItem, ListItemButton, Paper, CircularProgress } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

// Helper function to slugify headings for IDs
const slugify = (text: any): string => {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '');
};

interface HeadingInfo {
  id: string;
  text: string;
  level: number;
}

interface Section {
  id: string;
  title: string;
  content: string;
}

export const UserGuidePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);
  const [headings, setHeadings] = useState<HeadingInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all markdown files and combine them
  useEffect(() => {
    const loadGuides = async () => {
      try {
        setLoading(true);
        
        // Import all markdown files
        // Note: In Create React App, we need to use require() for dynamic imports
        // or use raw-loader with explicit imports
        const sections = [
          {
            id: 'getting-started',
            title: 'Getting Started',
            content: await fetch('/docs/user-guide/getting-started.md').then(r => r.text())
          },
          {
            id: 'editing-languoids',
            title: 'Editing Languoids',
            content: await fetch('/docs/user-guide/editing-languoids.md').then(r => r.text())
          },
          {
            id: 'batch-editor',
            title: 'Batch Editor Overview',
            content: await fetch('/docs/user-guide/batch-editor/overview.md').then(r => r.text())
          },
          {
            id: 'languoid-batch',
            title: 'Batch Editing Languoids',
            content: await fetch('/docs/user-guide/batch-editor/languoid-batch.md').then(r => r.text())
          },
          {
            id: 'importing-data',
            title: 'Importing Data',
            content: await fetch('/docs/user-guide/batch-editor/importing-data.md').then(r => r.text())
          },
          {
            id: 'keyboard-shortcuts',
            title: 'Keyboard Shortcuts',
            content: await fetch('/docs/user-guide/batch-editor/keyboard-shortcuts.md').then(r => r.text())
          },
        ];

        // Store sections for rendering
        setSections(sections);
        setLoading(false);
      } catch (error) {
        console.error('Error loading user guide:', error);
        setSections([{
          id: 'error',
          title: 'Error',
          content: '# Error Loading User Guide\n\nPlease try refreshing the page.'
        }]);
        setLoading(false);
      }
    };

    loadGuides();
  }, []);

  // Extract headings for TOC after sections render
  useEffect(() => {
    if (sections.length === 0) return;

    const extractHeadings = () => {
      const headingElements = document.querySelectorAll('.user-guide-content h1, .user-guide-content h2, .user-guide-content h3');
      const extracted = Array.from(headingElements).map(el => ({
        id: el.id,
        text: el.textContent || '',
        level: parseInt(el.tagName[1])
      }));
      setHeadings(extracted);
    };

    // Wait for markdown to render
    setTimeout(extractHeadings, 200);
  }, [sections]);

  // Scroll to anchor on load or hash change
  useEffect(() => {
    if (loading) return; // Don't scroll while loading
    
    const hash = location.hash.slice(1);
    if (hash) {
      // Longer timeout to ensure markdown is fully rendered
      const scrollToElement = () => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // If element not found, try again after a short delay
          setTimeout(scrollToElement, 100);
        }
      };
      
      setTimeout(scrollToElement, 400);
    } else {
      // Scroll to top if no hash
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.hash, loading]);

  const handleTOCClick = (id: string) => {
    navigate(`/user-guide#${id}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 3, p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Sticky Table of Contents */}
      <Paper
        elevation={2}
        sx={{
          width: 280,
          p: 2,
          position: 'sticky',
          top: 80,
          height: 'fit-content',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
          display: { xs: 'none', md: 'block' } // Hide on mobile
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Contents
        </Typography>
        <List dense>
          {headings.map(heading => (
            <ListItem
              key={heading.id}
              disablePadding
              sx={{ pl: (heading.level - 1) * 2 }}
            >
              <ListItemButton
                onClick={() => handleTOCClick(heading.id)}
                sx={{
                  py: 0.5,
                  px: 1,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                <Typography
                  variant={heading.level === 1 ? 'body2' : 'caption'}
                  sx={{
                    fontWeight: heading.level === 1 ? 600 : 400,
                    color: heading.level === 1 ? 'text.primary' : 'text.secondary'
                  }}
                >
                  {heading.text}
                </Typography>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, minWidth: 0 }} className="user-guide-content">
        {sections.map((section, index) => (
          <Box
            key={section.id}
            id={section.id}
            sx={{
              scrollMarginTop: 80, // Offset for sticky elements
              mb: index < sections.length - 1 ? 4 : 0, // Add margin between sections
            }}
          >
            <ReactMarkdown
              components={{
                h1: ({ node, children, ...props }) => {
                  const id = slugify(children);
                  return (
                    <Typography
                      variant="h3"
                      component="h1"
                      id={id}
                      sx={{
                        mt: 6,
                        mb: 2,
                        scrollMarginTop: 80,
                        fontWeight: 600,
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                        pb: 1
                      }}
                      {...props}
                    >
                      {children}
                    </Typography>
                  );
                },
            h2: ({ node, children, ...props }) => {
              const id = slugify(children);
              return (
                <Typography
                  variant="h4"
                  component="h2"
                  id={id}
                  sx={{
                    mt: 4,
                    mb: 1.5,
                    scrollMarginTop: 80,
                    fontWeight: 600
                  }}
                  {...props}
                >
                  {children}
                </Typography>
              );
            },
            h3: ({ node, children, ...props }) => {
              const id = slugify(children);
              return (
                <Typography
                  variant="h5"
                  component="h3"
                  id={id}
                  sx={{
                    mt: 3,
                    mb: 1,
                    scrollMarginTop: 80,
                    fontWeight: 600
                  }}
                  {...props}
                >
                  {children}
                </Typography>
              );
            },
            p: ({ node, ...props }) => (
              <Typography variant="body1" paragraph sx={{ lineHeight: 1.7 }} {...props} />
            ),
            ul: ({ node, ...props }) => (
              <Box component="ul" sx={{ pl: 3, my: 2 }} {...props} />
            ),
            ol: ({ node, ...props }) => (
              <Box component="ol" sx={{ pl: 3, my: 2 }} {...props} />
            ),
            li: ({ node, ...props }) => (
              <Typography component="li" variant="body1" sx={{ mb: 0.5 }} {...props} />
            ),
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <Box
                  component="code"
                  sx={{
                    backgroundColor: 'grey.100',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.5,
                    fontFamily: 'monospace',
                    fontSize: '0.875em'
                  }}
                  {...props}
                />
              ) : (
                <Box
                  component="pre"
                  sx={{
                    backgroundColor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    my: 2
                  }}
                >
                  <code style={{ fontFamily: 'monospace', fontSize: '0.875rem' }} {...props} />
                </Box>
              ),
            table: ({ node, ...props }) => (
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  my: 2,
                  '& th, & td': {
                    border: '1px solid',
                    borderColor: 'divider',
                    px: 2,
                    py: 1
                  },
                  '& th': {
                    backgroundColor: 'grey.100',
                    fontWeight: 600
                  }
                }}
                {...props}
              />
            ),
            hr: ({ node, ...props }) => (
              <Box
                component="hr"
                sx={{
                  border: 'none',
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  my: 4
                }}
                {...props}
              />
            ),
          }}
        >
          {section.content}
        </ReactMarkdown>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

