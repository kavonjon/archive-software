import React from 'react';
import { Box, Container, Typography, Link as MuiLink, Divider } from '@mui/material';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={{
        mt: 'auto',
        py: 3,
        px: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === 'light'
            ? theme.palette.grey[200]
            : theme.palette.grey[800],
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        {/* NEH Acknowledgment */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            This resource has been made possible in part by the National Endowment for the 
            Humanities: Humanities Collections and Reference Resources grants (
            <MuiLink
              href="https://www.neh.gov"
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              underline="hover"
              aria-label="Visit National Endowment for the Humanities website (opens in new tab)"
            >
              www.neh.gov
            </MuiLink>
            ). Any views, findings, conclusions, or recommendations expressed in this resource 
            do not necessarily represent those of the National Endowment for the Humanities.
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Accessibility Statement and Copyright */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}
        >
          {/* Accessibility Statement */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              This website is committed to accessibility standards.{' '}
              <MuiLink
                href="https://www.w3.org/WAI/standards-guidelines/wcag/"
                target="_blank"
                rel="noopener noreferrer"
                color="primary"
                underline="hover"
                aria-label="Learn about WCAG 2.1 Level AA accessibility standards (opens in new tab)"
              >
                WCAG 2.1 Level AA compliant
              </MuiLink>
            </Typography>
          </Box>

          {/* Copyright */}
          <Typography variant="body2" color="text.secondary">
            © {currentYear} Native American Languages Archive
          </Typography>
        </Box>

        {/* Contact or Accessibility Issues Link (Optional) */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            If you experience any accessibility issues with this website, please{' '}
            <MuiLink
              href="mailto:language.samnoblemuseum@ou.edu"
              color="primary"
              underline="hover"
              aria-label="Contact us about accessibility issues via email"
            >
              contact us
            </MuiLink>
            .
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;

