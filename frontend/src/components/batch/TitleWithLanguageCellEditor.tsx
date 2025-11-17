import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  CircularProgress,
  Typography,
} from '@mui/material';
import { SpreadsheetCell } from '../../types/spreadsheet';
import { Languoid } from '../../services/api';

interface TitleWithLanguage {
  title: string;
  language: {
    id: number;
    name: string;
    glottocode: string;
  } | null;
}

interface TitleWithLanguageCellEditorProps {
  cell: SpreadsheetCell;
  onCommit: (newValue: { value: any; text: string }, moveDown?: boolean) => void;
  onCancel: () => void;
  languoidOptions: Languoid[];
  loadingLanguoids: boolean;
}

/**
 * Custom cell editor for ItemTitle fields with language association.
 * 
 * This editor allows users to:
 * - Enter title text
 * - Select a language (filtered to level_glottolog='language' only)
 * 
 * The backend handles ItemTitle object creation/update/deletion.
 * Display format: "Title Text (Language Name)"
 */
export const TitleWithLanguageCellEditor: React.FC<TitleWithLanguageCellEditorProps> = ({
  cell,
  onCommit,
  onCancel,
  languoidOptions,
  loadingLanguoids,
}) => {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // State for title and language
  const [titleText, setTitleText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Languoid | null>(null);
  
  // State for autocomplete dropdown
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);

  // Initialize from cell value ONCE on mount
  useEffect(() => {
    if (cell.value && typeof cell.value === 'object') {
      const titleData = cell.value as TitleWithLanguage;
      setTitleText(titleData.title || '');
      if (titleData.language) {
        setSelectedLanguage(titleData.language as any);
      }
    }
  }, []); // Only run once on mount

  // Use ref to always have current values
  const currentValuesRef = useRef({ titleText, selectedLanguage });
  useEffect(() => {
    currentValuesRef.current = { titleText, selectedLanguage };
  }, [titleText, selectedLanguage]);

  // Handle commit
  const handleCommit = useCallback(() => {
    const { titleText: currentTitle, selectedLanguage: currentLang } = currentValuesRef.current;
    
    // If title is empty, commit null (clear the field)
    if (!currentTitle || currentTitle.trim() === '') {
      onCommit({ value: null, text: '' }, true);
      return;
    }
    
    // Format value and text
    const value: TitleWithLanguage = {
      title: currentTitle,
      language: currentLang ? {
        id: currentLang.id,
        name: currentLang.name,
        glottocode: currentLang.glottocode
      } : null
    };
    
    const text = currentLang ? 
      `${currentTitle} (${currentLang.name})` : 
      currentTitle;
    
    onCommit({ value, text }, true);
  }, [onCommit]);

  // Handle blur on the title input (not the autocomplete)
  const handleTitleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    
    // If focus is moving to the language autocomplete, don't commit
    if (relatedTarget && editorRef.current?.contains(relatedTarget)) {
      return;
    }
    
    // If focus is moving to the Autocomplete dropdown (rendered in portal), don't commit
    // We check for MUI's autocomplete classes
    if (relatedTarget?.closest('.MuiAutocomplete-popper')) {
      return;
    }
    
    // Focus is moving outside the editor, commit changes
    handleCommit();
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // If Autocomplete dropdown is open, let it handle the Escape key to close itself
      // Don't cancel the editor in this case
      if (autocompleteOpen) {
        return;
      }
      // Dropdown is closed, so Escape should cancel the editor
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Commit on Enter (unless in multiline mode with Shift)
      // Only if autocomplete is closed (to allow Enter to select in dropdown)
      if (!autocompleteOpen) {
        e.preventDefault();
        e.stopPropagation();
        handleCommit();
      }
    }
  };

  return (
    <div
      ref={editorRef}
      tabIndex={0}
      style={{
        width: '100%',
        minHeight: 150,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        border: '2px solid #1976d2',
        borderRadius: 4,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        outline: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Title input */}
      <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0' }}>
        <TextField
          inputRef={titleInputRef}
          fullWidth
          label="Title"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleTitleBlur}
          autoFocus
          size="small"
          variant="outlined"
          placeholder="Enter title text..."
        />
      </Box>

      {/* Language selector */}
      <Box sx={{ p: 1 }}>
        <Autocomplete
          open={autocompleteOpen}
          onOpen={() => setAutocompleteOpen(true)}
          onClose={(_, reason) => {
            setAutocompleteOpen(false);
            // Only commit if user clicked away from the entire editor
            // Don't commit on selection or Escape (those are handled elsewhere)
            if (reason === 'blur') {
              // Check if we're still within the editor
              setTimeout(() => {
                const activeElement = document.activeElement as HTMLElement;
                if (!activeElement || !editorRef.current?.contains(activeElement)) {
                  handleCommit();
                }
              }, 0);
            }
          }}
          options={languoidOptions}
          getOptionLabel={(option) => option.name}
          value={selectedLanguage}
          onChange={(_, newValue) => setSelectedLanguage(newValue)}
          loading={loadingLanguoids}
          size="small"
          clearOnBlur={false}
          blurOnSelect={false}
          filterOptions={(options, { inputValue }) => {
            // Custom filter: case-insensitive partial match on name or glottocode
            const query = inputValue.toLowerCase().trim();
            if (!query) return options;
            
            return options.filter(lang =>
              lang.name.toLowerCase().includes(query) ||
              (lang.glottocode && lang.glottocode.toLowerCase().includes(query))
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Language"
              placeholder="Search for a language..."
              variant="outlined"
              size="small"
              onKeyDown={handleKeyDown}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingLanguoids ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box>
                <Typography variant="body2">{option.name}</Typography>
                {option.glottocode && (
                  <Typography variant="caption" color="text.secondary">
                    {option.glottocode}
                  </Typography>
                )}
              </Box>
            </li>
          )}
        />
      </Box>

      {/* Footer with instructions */}
      <Box
        sx={{
          p: 1,
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Press Enter to save, Escape to cancel
        </Typography>
      </Box>
    </div>
  );
};

