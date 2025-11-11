import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  useTheme,
  useMediaQuery,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { focusUtils, formUtils } from '../utils/accessibility';

const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const formRef = useRef<HTMLFormElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  // Get the redirect path from location state, or default to items
  const from = (location.state as any)?.from?.pathname || '/items';

  // Focus management
  useEffect(() => {
    // Focus the username field when component mounts
    if (usernameRef.current) {
      usernameRef.current.focus();
    }
  }, []);

  // Announce errors to screen readers
  useEffect(() => {
    if (state.error) {
      focusUtils.announce(state.error, 'assertive');
    }
  }, [state.error]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      focusUtils.announce('Please fill in all required fields', 'assertive');
      return;
    }

    const success = await login(username, password);
    if (success) {
      focusUtils.announce('Login successful. Redirecting...', 'polite');
      // Redirect to the page they were trying to access, or to items
      navigate(from, { replace: true });
    }
  };

  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); // Prevent the button from stealing focus from the input
  };

  const isFormValid = username.trim() && password.trim();

  return (
    <Container 
      maxWidth="sm" 
      sx={{ 
        py: { xs: 2, sm: 4 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 2,
          maxWidth: '100%',
        }}
        component="section"
        aria-labelledby="login-title"
      >
        <Typography 
          id="login-title"
          variant={isMobile ? "h5" : "h4"} 
          component="h1" 
          gutterBottom 
          align="center"
          sx={{ 
            mb: 3,
            fontWeight: 'medium',
          }}
        >
          Login to NAL Archive
        </Typography>

        {/* Error Alert */}
        {state.error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            {...formUtils.generateErrorProps('login')}
          >
            {state.error}
          </Alert>
        )}

        <Box
          component="form"
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="login-title"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <TextField
            {...formUtils.generateFieldProps('username', 'Username', true)}
            inputRef={usernameRef}
            label="Username"
            variant="outlined"
            value={username}
            onChange={handleUsernameChange}
            required
            fullWidth
            autoComplete="username"
            disabled={state.isLoading}
            error={state.error !== null && !username.trim()}
            helperText={
              state.error !== null && !username.trim() 
                ? 'Username is required' 
                : ''
            }
            inputProps={{
              'aria-describedby': state.error ? 'login-error username-help' : 'username-help',
            }}
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '48px', // Touch-friendly
              },
            }}
          />

          <TextField
            {...formUtils.generateFieldProps('password', 'Password', true)}
            label="Password"
            type={showPassword ? 'text' : 'password'}
            variant="outlined"
            value={password}
            onChange={handlePasswordChange}
            required
            fullWidth
            autoComplete="current-password"
            disabled={state.isLoading}
            error={state.error !== null && !password.trim()}
            helperText={
              state.error !== null && !password.trim() 
                ? 'Password is required' 
                : ''
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={handleTogglePasswordVisibility}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                    disabled={state.isLoading}
                    sx={{
                      minWidth: '44px',
                      minHeight: '44px',
                    }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            inputProps={{
              'aria-describedby': state.error ? 'login-error password-help' : 'password-help',
            }}
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '48px', // Touch-friendly
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={state.isLoading || !isFormValid}
            startIcon={state.isLoading ? <CircularProgress size={20} color="inherit" aria-label="Signing in" /> : null}
            sx={{
              minHeight: '48px', // Touch-friendly
              mt: 1,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 'medium',
            }}
            aria-describedby={!isFormValid ? 'submit-help' : undefined}
          >
            {state.isLoading ? 'Logging in...' : 'Login'}
          </Button>

          {/* Hidden help text for form validation */}
          <Box 
            {...formUtils.generateHelpProps('username')}
            sx={{ display: 'none' }}
          >
            Enter your username to log in
          </Box>
          
          <Box 
            {...formUtils.generateHelpProps('password')}
            sx={{ display: 'none' }}
          >
            Enter your password to log in
          </Box>

          {!isFormValid && (
            <Typography
              id="submit-help"
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', mt: 1 }}
              role="status"
              aria-live="polite"
            >
              Please fill in all fields to continue
            </Typography>
          )}
        </Box>

        {/* Additional help text for screen readers */}
        <Box
          sx={{ 
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          {state.isLoading && 'Logging in, please wait...'}
        </Box>
      </Paper>
    </Container>
  );
};

export default LoginForm;