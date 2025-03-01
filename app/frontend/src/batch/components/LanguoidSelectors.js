// src/components/LanguoidSelectors.js
import React, { useState, useEffect, useRef } from 'react';
import { LEVEL_VOCABULARY } from './constants';

const baseStyles = {
  container: {
    padding: '5px',
    background: 'white',
    boxShadow: '0 0 5px rgba(0,0,0,0.1)'
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    marginBottom: '5px'
  },
  tag: {
    background: '#e0e0e0',
    margin: '2px',
    padding: '2px 5px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center'
  },
  removeButton: {
    marginLeft: '5px',
    border: 'none',
    background: 'none',
    cursor: 'pointer'
  },
  input: {
    width: '100%',
    padding: '5px'
  },
  suggestionList: {
    listStyle: 'none',
    padding: 0,
    margin: '5px 0 0',
    maxHeight: '100px',
    overflowY: 'auto',
    border: '1px solid #ccc'
  },
  suggestionItem: {
    padding: '5px',
    cursor: 'pointer',
    '&:hover': {
      background: '#f0f0f0'
    }
  }
};

export const MultiLanguoidSelector = ({ value, onChange, allLanguoids, placeholder }) => {
  const [selectedLanguoids, setSelectedLanguoids] = useState(value || []);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setInputValue(input);
    if (input.trim()) {
      const languoidsArray = Object.values(allLanguoids).filter(lang => lang && typeof lang === 'object');
      const filtered = languoidsArray.filter(lang => 
        (lang.name && lang.name.toLowerCase().includes(input.toLowerCase())) || 
        (lang.glottocode && lang.glottocode.toLowerCase().includes(input.toLowerCase()))
      ).filter(lang => !selectedLanguoids.some(selected => selected.id === lang.id));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const addLanguoid = (languoid) => {
    if (!selectedLanguoids.some(l => l.id === languoid.id)) {
      const newSelectedLanguoids = [...selectedLanguoids, { id: languoid.id, name: languoid.name }];
      setSelectedLanguoids(newSelectedLanguoids);
      onChange(newSelectedLanguoids);
    }
    setInputValue('');
    setSuggestions([]);
    inputRef.current.focus();
  };

  const removeLanguoid = (id) => {
    const newSelectedLanguoids = selectedLanguoids.filter(l => l.id !== id);
    setSelectedLanguoids(newSelectedLanguoids);
    onChange(newSelectedLanguoids);
    inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      addLanguoid(suggestions[0]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  return (
    <div style={baseStyles.container} tabIndex={0} onKeyDown={handleKeyDown}>
      <div style={baseStyles.tagContainer}>
        {selectedLanguoids.map(languoid => (
          <span key={languoid.id} style={baseStyles.tag}>
            {languoid.name}
            <button onClick={() => removeLanguoid(languoid.id)} style={baseStyles.removeButton}>×</button>
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        style={baseStyles.input}
      />
      {suggestions.length > 0 && (
        <ul style={baseStyles.suggestionList}>
          {suggestions.map(lang => (
            <li 
              key={lang.id} 
              onClick={() => addLanguoid(lang)}
              style={baseStyles.suggestionItem}
            >
              {lang.name} {lang.glottocode ? `(${lang.glottocode})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const SingleLanguoidSelector = ({ value, onChange, allLanguoids, placeholder }) => {
  const [inputValue, setInputValue] = useState(value ? value.name : '');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    setInputValue(value ? value.name : '');
  }, [value]);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setInputValue(input);
    if (input.trim()) {
      const languoidsArray = Object.values(allLanguoids).filter(lang => lang && typeof lang === 'object');
      const filtered = languoidsArray.filter(lang => 
        (lang.name && lang.name.toLowerCase().includes(input.toLowerCase())) ||
        (lang.glottocode && lang.glottocode.toLowerCase().includes(input.toLowerCase()))
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
      onChange(null);
    }
  };

  const selectLanguoid = (languoid) => {
    setInputValue(languoid.name);
    onChange({ id: languoid.id, name: languoid.name });
    setSuggestions([]);
  };

  return (
    <div style={baseStyles.container}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        style={baseStyles.input}
      />
      {suggestions.length > 0 && (
        <ul style={baseStyles.suggestionList}>
          {suggestions.map(lang => (
            <li 
              key={lang.id} 
              onClick={() => selectLanguoid(lang)}
              style={baseStyles.suggestionItem}
            >
              {lang.name} {lang.glottocode ? `(${lang.glottocode})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ChildDialectSelector = (props) => (
  <MultiLanguoidSelector {...props} placeholder="Search for child dialects..." />
);

export const ParentLanguoidSelector = (props) => (
  <SingleLanguoidSelector {...props} placeholder="Select parent languoid..." />
);

export const LevelEditor = ({ value, onChange }) => {
  const handleChange = (e) => {
    const newValue = e.target.value;
    const displayValue = LEVEL_VOCABULARY[newValue.toLowerCase()] || newValue;
    onChange(displayValue);
  };

  return (
    <select value={value} onChange={handleChange} style={baseStyles.input}>
      <option value="">Select a level</option>
      {Object.entries(LEVEL_VOCABULARY).map(([key, display]) => (
        <option key={key} value={display}>{display}</option>
      ))}
    </select>
  );
};