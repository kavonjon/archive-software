import React, { useState, useEffect, useRef, useCallback } from 'react';
import Spreadsheet, { DataViewer, DataEditor } from 'react-spreadsheet';
import axios from 'axios';
import { produce } from 'immer';
import { ChildDialectSelector, SingleLanguoidSelector, LevelEditor } from './LanguoidSelectors';
import { LEVEL_VOCABULARY } from './constants';
import './LanguoidSheet.css';
import WarningOverlay from './WarningOverlay';

// Add this line to set up axios defaults
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

// class ErrorBoundary extends React.Component {
//   constructor(props) {
//     super(props);
//     this.state = { hasError: false };
//   }

//   static getDerivedStateFromError(error) {
//     return { hasError: true };
//   }

//   componentDidCatch(error, errorInfo) {
//     console.log('Error caught by boundary:', error, errorInfo);
//   }

//   render() {
//     if (this.state.hasError) {
//       return <h1>Something went wrong.</h1>;
//     }

//     return this.props.children; 
//   }
// }

// Add these validation functions at the top of the file
const validateGlottocode = (value, allLanguoids) => {
  // First, check the format
  if (!/^[a-z]{4}[0-9]{4}$/.test(value)) {
    return false;
  }

  // Then, check for uniqueness
  const occurrences = Object.values(allLanguoids).filter(lang => lang.glottocode === value).length;
  return occurrences <= 1;
};

const validateLanguoidReference = (value, allLanguoids, allowMultiple = false) => {
  if (!value) return true; // Allow empty values
  
  let languoidNames = [];
  if (typeof value === 'string') {
    languoidNames = allowMultiple ? value.split(',').map(v => v.trim()) : [value.trim()];
  } else if (Array.isArray(value)) {
    languoidNames = value.map(v => typeof v === 'string' ? v : v.name);
  } else if (typeof value === 'object' && value !== null) {
    languoidNames = [value.name];
  }

  return languoidNames.every(name => 
    name && Object.values(allLanguoids).some(lang => lang.name === name)
  );
};

const validateName = (value) => {
  return value.trim() !== '';
};

const COLUMN_INFO = [
  { key: 'glottocode', label: 'Glottocode', index: 0, type: 'text', validate: (value, allLanguoids) => validateGlottocode(value, allLanguoids) },
  { key: 'iso', label: 'ISO Code', index: 1, type: 'text' },
  { key: 'name', label: 'Name', index: 2, type: 'text', validate: validateName },
  { key: 'level', label: 'Level', index: 3, type: 'level' },
  { key: 'child_languoids', label: 'Children/Dialects', index: 4, type: 'multi-languoid', validate: (value, allLanguoids) => validateLanguoidReference(value, allLanguoids, true) },
  { key: 'family_languoid', label: 'Family Languoid', index: 5, type: 'single-languoid', validate: (value, allLanguoids) => validateLanguoidReference(value, allLanguoids) },
  { key: 'pri_subgroup_languoid', label: 'Primary Subgroup Languoid', index: 6, type: 'single-languoid', validate: (value, allLanguoids) => validateLanguoidReference(value, allLanguoids) },
  { key: 'sec_subgroup_languoid', label: 'Secondary Subgroup Languoid', index: 7, type: 'single-languoid', validate: (value, allLanguoids) => validateLanguoidReference(value, allLanguoids) },
  { key: 'parent_languoid', label: 'Parent Languoid', index: 8, type: 'single-languoid', validate: (value, allLanguoids) => validateLanguoidReference(value, allLanguoids) },
  { key: 'language_languoid', label: 'Language Languoid', index: 9, type: 'single-languoid', validate: (value, allLanguoids) => validateLanguoidReference(value, allLanguoids) },
  { key: 'alt_name', label: 'Alternative Name(s)', index: 10, type: 'text' },
  { key: 'region', label: 'Region', index: 11, type: 'text' },
  { key: 'tribes', label: 'Tribe(s)', index: 12, type: 'text' },
  { key: 'notes', label: 'Notes', index: 13, type: 'text' },
];

const getModifiedColumnInfo = (viewType) => {
  let modifiedColumnInfo = [...COLUMN_INFO];

  if (viewType === 'languages') {
    modifiedColumnInfo = modifiedColumnInfo.filter(col => col.key !== 'level');
    const childLanguoidsIndex = modifiedColumnInfo.findIndex(col => col.key === 'child_languoids');
    if (childLanguoidsIndex !== -1) {
      modifiedColumnInfo[childLanguoidsIndex] = {
        ...modifiedColumnInfo[childLanguoidsIndex],
        label: 'Dialects'
      };
    }
  } else if (viewType === 'families' || viewType === 'descendants') {
    const childLanguoidsIndex = modifiedColumnInfo.findIndex(col => col.key === 'child_languoids');
    if (childLanguoidsIndex !== -1) {
      modifiedColumnInfo[childLanguoidsIndex] = {
        ...modifiedColumnInfo[childLanguoidsIndex],
        label: 'Children'
      };
    }
  }

  return modifiedColumnInfo.map((col, index) => ({ ...col, index }));
};

const StatusIndicator = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'invalid':
        return { backgroundColor: 'red' };
      case 'modified':
        return { backgroundColor: 'yellow', border: '1px solid grey' };
      case 'updated-session':
        return { backgroundColor: '#4CAF50' };
      case 'updated-recent':
        return { backgroundColor: 'transparent', border: '2px solid skyblue' };
      default:
        return { backgroundColor: 'transparent' };
    }
  };

  return (
    <div
      className="status-indicator"
      style={{
        ...getStyle(),
        boxSizing: 'border-box',
      }}
    />
  );
};

const SpreadsheetWithStatus = ({ data, statusGetter, ...props }) => {
  const [cellHeight, setCellHeight] = useState(24); // Default height
  const spreadsheetRef = useRef(null);

  useEffect(() => {
    const updateCellHeight = () => {
      if (spreadsheetRef.current) {
        const cells = spreadsheetRef.current.querySelectorAll('.Spreadsheet__cell');
        if (cells.length > 0) {
          const cellRect = cells[0].getBoundingClientRect();
          const newHeight = cellRect.height;
          if (newHeight !== cellHeight) {  // Only update if height actually changed
            setCellHeight(newHeight);
          }
        }
      }
    };

    updateCellHeight();
    window.addEventListener('resize', updateCellHeight);

    return () => window.removeEventListener('resize', updateCellHeight);
  }, []);

  return (
    <div className="spreadsheet-with-status">
      <div className="status-column" style={{ paddingTop: `${cellHeight}px` }}>
        {data.map((row, index) => (
          <div key={index} className="status-cell" style={{ height: `${cellHeight}px` }}>
            <StatusIndicator status={statusGetter(index)} />
          </div>
        ))}
      </div>
      <div className="spreadsheet-wrapper" ref={spreadsheetRef}>
        <Spreadsheet data={data} {...props} />
      </div>
    </div>
  );
};

const AddRowsSection = ({ rowsToAdd, setRowsToAdd, handleAddRows }) => (
  <div className="add-rows-container">
    <button onClick={handleAddRows}>Add</button>
    <input
      type="number"
      value={rowsToAdd}
      onChange={(e) => setRowsToAdd(Number(e.target.value))}
      min="1"
    />
    <span>more rows at the bottom</span>
  </div>
);

const LanguoidSheet = ({ onClose }) => {
  const [viewType, setViewType] = useState('');
  const [title, setTitle] = useState('');
  const [languoids, setLanguoids] = useState({});
  const [savedLanguoids, setSavedLanguoids] = useState({});
  const [data, setData] = useState([]);
  const [modifiedCells, setModifiedCells] = useState({}); // Track modified cells
  const [isEditing, setIsEditing] = useState(false); // Add this line
  const [updatedDuringSession, setUpdatedDuringSession] = useState({});
  const [selectedRange, setSelectedRange] = useState(null);
  const [activeCell, setActiveCell] = useState(null);
  const [editedCellValue, setEditedCellValue] = useState(null);
  // const [pendingChanges, setPendingChanges] = useState([]);
  const [showWarning, setShowWarning] = useState(false);
  const [invalidRows, setInvalidRows] = useState([]);
  const [visibleColumnInfo, setVisibleColumnInfo] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rowsToAdd, setRowsToAdd] = useState(100);
  const [rowToIdMap, setRowToIdMap] = useState({});
  const [canGenerateGlottocodes, setCanGenerateGlottocodes] = useState(false);
  const [canAddFamilyEntries, setCanAddFamilyEntries] = useState(false);
  const [isGeneratingGlottocodes, setIsGeneratingGlottocodes] = useState(false);
  const [isAddingFamilyEntries, setIsAddingFamilyEntries] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    console.log('Current path:', path);
    if (path.endsWith('/batch/')) {
      setViewType('all');
      setTitle('Batch edit languoids');
    } else if (path.includes('/batch/languages')) {
      setViewType('languages');
      setTitle('Batch edit languages');
    } else if (path.includes('/batch/families')) {
      setViewType('families');
      setTitle('Batch edit families');
    } else if (path.includes('/batch/new')) {
      setViewType('new');
      setTitle('Add new languoids');
    } else {
      const glottocode = path.split('/').pop();
      if (glottocode) {
        setViewType('descendants');
        // We'll set the title after fetching the root languoid
      }
    }
  }, []);

  useEffect(() => {
    if (viewType) {
      console.log('ViewType set to:', viewType);
      const modifiedColumnInfo = getModifiedColumnInfo(viewType);
      setVisibleColumnInfo(modifiedColumnInfo);
    }
  }, [viewType]);

  useEffect(() => {
    if (viewType && visibleColumnInfo.length > 0) {
      console.log('Fetching languoids for viewType:', viewType);
      fetchLanguoids();
    }
  }, [viewType, visibleColumnInfo]);

  // Create lookup objects for easy access
  const getColumnIndex = (key) => {
    return visibleColumnInfo.findIndex(col => col.key === key);
  };
  const getColumnKey = (index) => {
    const column = visibleColumnInfo[index];
    return column ? column.key : undefined;
  };

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && !isEditing) {
        if (hasUnsavedChanges()) {
          const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
          if (confirmClose) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);

    // Cleanup function to remove the event listener
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose, modifiedCells, isEditing]);

  useEffect(() => {
    const newRowToIdMap = {};
    Object.entries(languoids).forEach(([id, languoid], index) => {
      newRowToIdMap[index] = id;
    });
    setRowToIdMap(newRowToIdMap);
  }, [languoids]);

  useEffect(() => {
    if (!data) return; // Add this guard clause
    
    const checkGlottocodes = data.some((row, index) => 
      !isRowEmpty(index, data) && !row[getColumnIndex('glottocode')].value
    );
    setCanGenerateGlottocodes(checkGlottocodes);

    const checkInvalidLanguoids = data.some((row, index) => 
      !isRowEmpty(index) && Object.keys(row).some(key => {
        const columnInfo = visibleColumnInfo.find(col => col.key === getColumnKey(key));
        if (columnInfo && (columnInfo.type === 'single-languoid' || columnInfo.type === 'multi-languoid') && row[key].value) {
          let values = [];
          if (typeof row[key].value === 'string') {
            values = columnInfo.type === 'multi-languoid' 
              ? row[key].value.split(',').map(v => v.trim()) 
              : [row[key].value.trim()];
          } else if (Array.isArray(row[key].value)) {
            values = row[key].value.map(v => v.name);
          } else if (typeof row[key].value === 'object' && row[key].value !== null) {
            values = [row[key].value.name];
          }
          return values.some(value => !Object.values(languoids).some(lang => lang.name === value));
        }
        return false;
      })
    );
    setCanAddFamilyEntries(checkInvalidLanguoids);
  }, [data, languoids, visibleColumnInfo, isAddingFamilyEntries, getColumnIndex, isRowEmpty, getColumnKey]);

  const fetchLanguoids = async () => {
    setIsLoading(true);
    try {
      let url = '/api/languages/';
      if (viewType === 'languages') {
        url += '?level=language';
      } else if (viewType === 'families') {
        url += '?level=family';
      } else if (viewType === 'descendants') {
        const glottocode = window.location.pathname.split('/').pop();
        url = `/api/languages/${glottocode}/descendants/`;
      }
      const response = await axios.get(url);
      console.log('API response:', response.data);
      const processedData = response.data.map(languoid => ({
        ...languoid,
        child_languoids: Array.isArray(languoid.child_languoids)
          ? languoid.child_languoids
          : []
      }));

      const languoidsObject = processedData.reduce((acc, languoid) => {
        acc[languoid.id] = languoid;
        return acc;
      }, {});
      
      setLanguoids(languoidsObject);
      setSavedLanguoids(languoidsObject);

      if (viewType === 'descendants') {
        const rootLanguoid = processedData.find(l => l.glottocode === glottocode);
        setTitle(`Batch edit languoids under node ${rootLanguoid.name} (${rootLanguoid.glottocode})`);
      }

      let spreadsheetData;
      if (viewType === 'new') {
        // For 'new' viewType, create empty rows
        spreadsheetData = Array(100).fill().map(() => 
          visibleColumnInfo.map(() => ({ value: '' }))
        );
      } else {
        spreadsheetData = convertLanguoidsToSpreadsheetData(processedData, visibleColumnInfo);
        const extraRows = Array(100).fill().map(() => 
          visibleColumnInfo.map(() => ({ value: '' }))
        );
        spreadsheetData = [...spreadsheetData, ...extraRows];
      }
      console.log('Spreadsheet data:', spreadsheetData);
      setData(spreadsheetData);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching languoids:", error);
      setIsLoading(false);
    }
  };

  const convertLanguoidsToSpreadsheetData = (languoids, columns) => {
    return languoids.map((languoid) => 
      columns.map(({ key, index }) => {
        let value = languoid[key];
        
        if (key === 'level') {
          value = LEVEL_VOCABULARY[value] || value;
        } else if (key === 'child_languoids') {
          value = languoid.child_languoids.map(d => d.name).join(', ');
        } else if (key.endsWith('_languoid') && value) {
          value = value.name;
        }
        
        return { value: value || '', className: '' };
      })
    );
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && isEditing) {
      if (activeCell) {
        applyChange(activeCell.row, activeCell.column);
      }
    } else if (event.key === 'Escape') {
      if (event.isTrusted) {  // isTrusted is true for real user events, false for programmatically created events

        if (isEditing) {        
          event.preventDefault();
          event.stopPropagation();
          handleCancelEdit();
          
          // Calculate timeout based on number of rows
          const rowCount = data.length;
          const baseTimeout = 15; // 75ms for every 1000 rows
          const timeout = Math.max(0, Math.ceil((rowCount / 1000) * baseTimeout));
          
          // Simulate an Escape key press on the spreadsheet
          setTimeout(() => {
            const escapeEvent = new KeyboardEvent('keydown', {
              key: 'Escape',
              bubbles: true,
              cancelable: true
            });
            const spreadsheetElement = document.querySelector('.Spreadsheet');
            if (spreadsheetElement) {
              spreadsheetElement.dispatchEvent(escapeEvent);
            }
          }, timeout);
        }
      }
    }
  };

  const handleModeChange = useCallback((mode) => {
    if (mode === 'edit') {
      setIsEditing(true);
      if (activeCell) {
        // // Create a deep copy of the cell value
        // const cellValue = data[activeCell.row][activeCell.column].value;
        // const deepCopy = JSON.parse(JSON.stringify(cellValue));
        setEditedCellValue({ ...data[activeCell.row][activeCell.column] });
      } else {
        console.log('No active cell on mode change to edit');
      }
    } else if (mode === 'view') {
      setIsEditing(false);
      setEditedCellValue(null);
    }
  }, [activeCell, data]);

  useEffect(() => {
    console.log('isEditing has changed to:', isEditing);
  }, [isEditing]);

  // const handleEvaluatedDataChange = (evaluatedData) => {
  //   console.log('Evaluated data:', evaluatedData);
  // };


  const parseLanguoidValue = (value, isMulti) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (isMulti) {
          return Array.isArray(parsed) ? parsed : [parsed];
        }
        return parsed;
      } catch (e) {
        // If it's not valid JSON, treat it as a comma-separated string of names
        return isMulti 
          ? value.split(',').map(name => ({ name: name.trim() }))
          : { name: value.trim() };
      }
    }
    return isMulti && !Array.isArray(value) ? [value] : value;
  };

  const hasValueChanged = (newValue, originalValue) => {
    // Handle empty values
    if (!newValue && !originalValue) return false;
    if (!newValue && originalValue === '') return false;
    if (newValue === '' && !originalValue) return false;

    // Handle arrays
    if (Array.isArray(newValue) && Array.isArray(originalValue)) {
      return newValue.length !== originalValue.length || 
             newValue.some((val, index) => hasValueChanged(val, originalValue[index]));
    }

    // Handle strings
    if (typeof newValue === 'string' && typeof originalValue === 'string') {
      return newValue.trim() !== originalValue.trim();
    }

    // Handle objects (non-null)
    if (typeof newValue === 'object' && newValue !== null &&
        typeof originalValue === 'object' && originalValue !== null) {
      const keys1 = Object.keys(newValue);
      const keys2 = Object.keys(originalValue);
      return keys1.length !== keys2.length || 
             keys1.some(key => hasValueChanged(newValue[key], originalValue[key]));
    }
    
    // Handle other types
    return newValue !== originalValue;
  };

  const handleChange = useCallback((changes) => {
    // Process all changes in a single pass
    const [newData, newSavedLanguoids] = produce([data, savedLanguoids], ([dataDraft, savedDraft]) => {
      changes.forEach((rowChanges, rowIndex) => {
        if (!Array.isArray(rowChanges)) return;
        
        const id = rowToIdMap[rowIndex];
        
        rowChanges.forEach((cell, columnIndex) => {
          if (!cell || typeof cell.value === 'undefined') return;
          if (rowIndex < 0 || rowIndex >= dataDraft.length || 
              columnIndex < 0 || columnIndex >= dataDraft[rowIndex].length) return;
          
          const columnInfo = visibleColumnInfo[columnIndex];
          if (!columnInfo) return;

          // Update data (spreadsheet display)
          dataDraft[rowIndex][columnIndex] = {
            value: cell.value,
            className: getCellValidationClass(cell.value, rowIndex, columnIndex)
          };

          // Update savedLanguoids if valid
          if (id && isValidChange(cell.value, columnInfo, rowIndex, columnIndex)) {
            if (!savedDraft[id]) {
              savedDraft[id] = { ...languoids[id] } || { id };
            }
            savedDraft[id][columnInfo.key] = processValueForApi(cell.value, columnInfo.type);
          }
        });
      });
    });

    // Update both state variables
    setData(newData);
    setSavedLanguoids(newSavedLanguoids);
  }, [data, savedLanguoids, languoids, visibleColumnInfo, rowToIdMap]);

  // New helper functions
  const getCellValidationClass = (value, rowIndex, columnIndex) => {
    if (isRowEmpty(rowIndex, data)) {
      return '';
    }

    const columnInfo = visibleColumnInfo[columnIndex];
    if (!columnInfo) return '';

    const id = rowToIdMap[rowIndex];
    
    // Special handling for required fields (glottocode and name)
    if ((columnInfo.key === 'glottocode' || columnInfo.key === 'name') && 
        (!value || value.trim() === '')) {
      // If any other cell in this row has data, these fields are required
      const rowHasData = data[rowIndex].some((cell, idx) => {
        const colKey = visibleColumnInfo[idx]?.key;
        return colKey && 
               colKey !== 'glottocode' && 
               colKey !== 'name' && 
               cell.value && 
               cell.value.trim() !== '';
      });
      
      if (rowHasData) {
        return 'invalid-cell';
      }
    }

    // Get the reference value to compare against
    let referenceValue;
    if (id && languoids[id]) {
      referenceValue = languoids[id][columnInfo.key];
    } else {
      referenceValue = createBlankLanguoid()[columnInfo.key];
    }

    // Only mark as modified if the value differs from reference
    // and isn't empty itself
    const hasChanged = hasValueChanged(value, referenceValue);
    const isEmpty = value === '' || value === null || value === undefined;
    
    if (hasChanged && !isEmpty) {
      if (!isValidChange(value, columnInfo, rowIndex, columnIndex)) {
        return 'invalid-cell';
      }
      return 'modified-cell';
    }

    return '';
  };

  const isValidChange = (value, columnInfo, rowIndex, columnIndex) => {
    if (!columnInfo.validate) return true;
    return columnInfo.validate(value, languoids);
  };

  const processValueForApi = (value, type) => {
    switch (type) {
      case 'multi-languoid':
        return Array.isArray(value) 
          ? value 
          : value.split(',').map(v => ({ name: v.trim() }));
      case 'single-languoid':
        return typeof value === 'string' 
          ? { name: value.trim() } 
          : value;
      default:
        return value;
    }
  };

  // useEffect(() => {
  //   if (pendingChanges.length > 0 && !isEditing) {
  //     pendingChanges.forEach(([row, column]) => {
  //       applyChange(row, column);
  //     });
  //     setPendingChanges([]); // Clear pending changes after applying
  //   }
  // }, [pendingChanges, isEditing, applyChange]);

  const applyChange = useCallback((row, column, isEmptyRow) => {
    return
    console.log(`Applying changes to row ${row}, column ${column}`);
    const columnInfo = visibleColumnInfo[column];
    const oldValue = savedLanguoids[row][column].value;
    const newValue = data[row][column].value;
    console.log('oldValue:', oldValue);
    console.log('newValue:', newValue);

    let modifiedValue = false;
    let className = '';
    const isModified = hasValueChanged(newValue, oldValue);
    if (isModified && !isEmptyRow) {
      console.log(`Cell at row ${row}, column ${column} is now "${JSON.stringify(newValue)}", originally "${JSON.stringify(oldValue)}".`);

      let isValid = true;
      if (columnInfo.validate) {
        isValid = columnInfo.validate(newValue, languoids);
      }
      modifiedValue = { modified: true, valid: isValid };
      className = isValid ? 'modified-cell' : 'invalid-cell';
    }

    setModifiedCells(prevModifiedCells => {
      const newModifiedCells = {
        ...prevModifiedCells,
        [`${row}-${column}`]: modifiedValue
      };
      console.log('Updated modifiedCells:', newModifiedCells);
      return newModifiedCells;
    });

    setData(produce(draft => {
      draft[row][column] = { 
        value: newValue,
        className: className
      };
    }));

  }, [data, savedLanguoids, languoids, visibleColumnInfo]);

  const handlePaste = (copiedData) => {
    console.log('Pasted data:', copiedData);
    const startRow = selectedRange ? selectedRange.start.row : 0;
    const startCol = selectedRange ? selectedRange.start.column : 0;

    copiedData.forEach((row, rowIndex) => {
      const isEmptyRow = isRowEmpty(startRow + rowIndex);
      row.forEach((cell, colIndex) => {
        const targetRow = startRow + rowIndex;
        const targetColumn = startCol + colIndex;
        if (targetColumn < visibleColumnInfo.length) {
          let value = cell.value;
          const columnKey = visibleColumnInfo[targetColumn].key;
          if (columnKey === 'child_languoids') {
            value = value.split(',').map(name => name.trim()).join(', ');
          }
          applyChange(targetRow, targetColumn, value, isEmptyRow);
        }
      });
    });
  };

  const handleUpdate = async () => {
    // Check for invalid cells
    const invalidCells = findInvalidCells();
    if (invalidCells.length > 0) {
      setInvalidRows(invalidCells);
      setShowWarning(true);
      return;
    }

    try {
      // Find changed records by comparing savedLanguoids with languoids
      const changedRecords = Object.entries(savedLanguoids)
        .filter(([id, savedLang]) => {
          const originalLang = languoids[id];
          return !originalLang || hasLanguoidChanged(savedLang, originalLang);
        })
        .map(([_, lang]) => lang);

      if (changedRecords.length === 0) {
        console.log('No modifications to update');
        return;
      }

      const response = await axios.post('/api/update-languages/', changedRecords);
      
      if (response.data.status === 'success') {
        // Update languoids with new data
        setLanguoids(prev => ({
          ...prev,
          ...response.data.updated.reduce((acc, lang) => {
            acc[lang.id] = lang;
            return acc;
          }, {})
        }));
        
        // Clear modifications
        setSavedLanguoids(prev => ({
          ...prev,
          ...response.data.updated.reduce((acc, lang) => {
            acc[lang.id] = lang;
            return acc;
          }, {})
        }));
      }
    } catch (error) {
      console.error('Error updating data:', error);
    }
  };

  // // Add a class to modified cells to change their background color
  // const getCellProps = (cell, rowIndex, columnIndex) => {
  //   const isModified = modifiedCells[`${rowIndex}-${columnIndex}`];
  //   // console.log(`Checking cell at row ${rowIndex}, column ${columnIndex}: modified=${isModified}`);
  //   if (isModified) {
  //     return {
  //       className: 'modified-cell',
  //     };
  //   }
  //   return {};
  // };

  // const CustomCell = ({ cell, ...props }) => (
  //   <Cell {...props}>
  //     <div style={cell.isModified ? { backgroundColor: 'rgba(144, 238, 144, 0.5)' } : {}}>
  //       {cell.value}
  //     </div>
  //   </Cell>
  // );

  // const CustomDataViewer = ({ cell, ...props }) => (
  //   <DataViewer {...props}>
  //     <div style={cell.isModified ? { backgroundColor: 'rgba(144, 238, 144, 0.5)' } : {}}>
  //       {cell.value}
  //     </div>
  //   </DataViewer>
  // );

  const getCellClass = (row, column) => {
    const cellState = modifiedCells[`${row}-${column}`];
    if (cellState) {
      if (!cellState.valid) {
        return 'invalid-cell';
      }
      if (cellState.modified) {
        return 'modified-cell';
      }
    }
    return '';
  };

  const handleCancelEdit = () => {
    console.log('Cancelling edit');
    console.log('activeCell:', activeCell);
    console.log('editedCellValue:', editedCellValue);
    
    if (editedCellValue) {
      // const startTime = performance.now();
      // setData(produce(draft => {
      //   draft[activeCell.row][activeCell.column] = editedCellValue;
      // }));
      setData(prevData => {
        const newData = [...prevData];
        newData[activeCell.row] = [...newData[activeCell.row]];
        newData[activeCell.row][activeCell.column] = editedCellValue;
        return newData;
      });
      // setActiveCell(null);
      // const endTime = performance.now();
      // console.log(`Time taken to update data: ${endTime - startTime} milliseconds`);
    }
  };

  // useEffect(() => {
  //   console.log('Data updated:', data);
  //   console.log(performance.now())
  // }, [data]);

  const CustomDataEditor = (props) => {
    if (!props.cell) {
      console.warn('CustomDataEditor received undefined cell');
      return null;
    }

    const columnInfo = visibleColumnInfo[props.column];
    
    return (
      <div className={getCellClass(props.row, props.column)}>
        {columnInfo.key === 'child_languoids' ? (
          <ChildDialectSelector
            value={props.cell.value || ''}
            onChange={(newValue) => {
              console.log('ChildDialectSelector onChange:', newValue);
              props.onChange({
                ...props,
                value: newValue
              });
            }}
            allLanguoids={languoids}
          />
        ) : columnInfo.type === 'single-languoid' ? (
          <SingleLanguoidSelector
            value={props.cell.value || ''}
            onChange={(newValue) => {
              console.log('SingleLanguoidSelector onChange:', newValue);
              props.onChange({
                ...props,
                value: newValue
              });
            }}
            allLanguoids={languoids}
          />
        ) : columnInfo.type === 'level' ? (
          <LevelEditor
            value={props.cell.value}
            onChange={(newValue) => props.onChange({ ...props.cell, value: newValue })}
          />
        ) : (
          <DataEditor {...props} />
        )}
      </div>
    );
  };

  const hasUnsavedChanges = () => {
    return Object.values(modifiedCells).some(cell => cell.modified);
  };

  const getRowStatus = (rowIndex) => {
    // Check for current modifications or invalidity
    const isInvalid = visibleColumnInfo.some(col => 
      modifiedCells[`${rowIndex}-${col.index}`]?.valid === false
    );
    if (isInvalid) return 'invalid';

    const isModified = visibleColumnInfo.some(col => 
      modifiedCells[`${rowIndex}-${col.index}`]?.modified
    );
    if (isModified) return 'modified';

    if (updatedDuringSession[rowIndex]) {
      return 'updated-session';
    }
    // Check if it was updated recently (in the last 24 hours)
    if (rowIndex < languoids.length) {
      const updatedDate = new Date(languoids[rowIndex].updated);
      const isUpdatedRecently = (new Date() - updatedDate) < 24 * 60 * 60 * 1000;
      if (isUpdatedRecently) return 'updated-recent';
    }
    return 'none';
  };

  const isRowEmpty = (rowIndex, currentData) => {
    if (!currentData || !currentData[rowIndex]) return true;
    
    return currentData[rowIndex].every(cell => {
      const value = cell.value;
      if (typeof value === 'string') {
        return value.trim() === '';
      } else if (typeof value === 'object' && value !== null) {
        return !value.name || value.name.trim() === '';
      }
      return !value;
    });
  };

  // useEffect(() => {
  //   console.log('Current modifiedCells state:', modifiedCells);
  //   console.log('Update button should be:', Object.values(modifiedCells).filter(cell => cell && cell.modified === true).length === 0 ? 'disabled' : 'enabled');
  // }, [modifiedCells]);


  const handleAddRows = () => {
    const newRows = Array(rowsToAdd).fill().map((_, index) => {
      const tempId = `new_${Date.now()}_${index}`;
      const emptyLanguoid = {
        id: tempId,
        glottocode: '',
        iso: '',
        name: '',
        level: '',
        child_languoids: [],
        family_languoid: null,
        pri_subgroup_languoid: null,
        sec_subgroup_languoid: null,
        parent_languoid: null,
        language_languoid: null,
        alt_name: '',
        region: '',
        tribes: '',
        notes: '',
      };

      // Add the new languoid to the languoids state
      setLanguoids(prevLanguoids => ({
        ...prevLanguoids,
        [tempId]: emptyLanguoid
      }));

      setRowToIdMap(prevMap => ({
        ...prevMap,
        [data.length + index]: tempId
      }));
      // Create the corresponding row for data and savedData
      return visibleColumnInfo.map(({ key }) => {
        let value = emptyLanguoid[key];
        if (key === 'child_languoids') {
          value = '';
        } else if (key.endsWith('_languoid')) {
          value = '';
        }
        return { value: value || '', className: '' };
      });
    });

    setData(prevData => [...prevData, ...newRows]);
    setSavedLanguoids(prevSavedLanguoids => ({
      ...prevSavedLanguoids,
      ...newRows.reduce((acc, row) => {
        const id = row[0].value;
        acc[id] = row;
        return acc;
      }, {})
    }));

    setRowToIdMap(prevMap => {
      const newMap = { ...prevMap };
      for (let i = 0; i < rowsToAdd; i++) {
        newMap[data.length + i] = `new_${Date.now()}_${i}`;
      }
      return newMap;
    });
  };

  const generateGlottocodes = () => {
    setIsGeneratingGlottocodes(true);
    let nextNumber = 123;
    const generatedGlottocodes = new Set();

    setData(prevData => {
      const newData = prevData.map((row, index) => {
        // Check if the row is not empty and the glottocode cell is empty
        if (!isRowEmpty(index) && !row[getColumnIndex('glottocode')].value) {
          const name = row[getColumnIndex('name')].value;
          if (!name) return row; // Skip if name is empty

          let letters = name.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 4);
          while (letters.length < 4) {
            letters += letters[letters.length - 1] || 'a';
          }

          let glottocode;
          do {
            glottocode = `${letters}${nextNumber.toString().padStart(4, '0')}`;
            nextNumber++;
          } while (Object.values(languoids).some(lang => lang.glottocode === glottocode) || generatedGlottocodes.has(glottocode));

          generatedGlottocodes.add(glottocode);

          const newRow = [...row];
          newRow[getColumnIndex('glottocode')] = { value: glottocode, className: 'modified-cell' };
          
          // Update languoids
          const id = rowToIdMap[index];
          if (id) {
            setLanguoids(prevLanguoids => ({
              ...prevLanguoids,
              [id]: {
                ...prevLanguoids[id],
                glottocode: glottocode
              }
            }));
          }

          return newRow;
        }
        return row;
      });

      return newData;
    });

    setIsGeneratingGlottocodes(false);
  };

  const addFamilyEntries = () => {
    setIsAddingFamilyEntries(true);

    setData(prevData => {
      let newData = [...prevData];
      let lastNonEmptyIndex = newData.findLastIndex(row => !isRowEmpty(newData.indexOf(row)));
      const newLanguoids = {};
      const newRowToIdMap = {};

      newData = newData.map((row, rowIndex) => {
        if (isRowEmpty(rowIndex)) return row;

        return row.map((cell, columnIndex) => {
          const columnInfo = visibleColumnInfo[columnIndex];
          if ((columnInfo.type === 'single-languoid' || columnInfo.type === 'multi-languoid') && cell.value) {
            const familyNames = cell.value.split(',').map(name => name.trim());
            const updatedFamilyNames = [];
            
            familyNames.forEach(familyName => {
              if (!Object.values(languoids).some(lang => lang.name === familyName)) {
                // Add new family entry
                lastNonEmptyIndex++;
                const newId = `new_${Date.now()}_${lastNonEmptyIndex}`;
                const newRow = visibleColumnInfo.map(() => ({ value: '', className: '' }));
                
                const nameColumnIndex = visibleColumnInfo.findIndex(col => col.key === 'name');
                const levelColumnIndex = visibleColumnInfo.findIndex(col => col.key === 'level');
                
                if (nameColumnIndex !== -1) {
                  newRow[nameColumnIndex] = { value: familyName, className: 'modified-cell' };
                }
                if (levelColumnIndex !== -1) {
                  newRow[levelColumnIndex] = { value: LEVEL_VOCABULARY.family, className: 'modified-cell' };
                }
                
                newData[lastNonEmptyIndex] = newRow;
                newLanguoids[newId] = {
                  id: newId,
                  name: familyName,
                  level: LEVEL_VOCABULARY.family,
                };
                newRowToIdMap[lastNonEmptyIndex] = newId;

                // Mark cells as modified
                setModifiedCells(prev => ({
                  ...prev,
                  [`${lastNonEmptyIndex},${nameColumnIndex}`]: { modified: true },
                  [`${lastNonEmptyIndex},${levelColumnIndex}`]: { modified: true },
                }));
              }
              // Add the family name to the updated list (whether it's new or existing)
              updatedFamilyNames.push(familyName);
            });
            
            // Update the original cell with all family names (existing and new)
            return { 
              value: updatedFamilyNames.join(', '), 
              className: 'modified-cell'  // Always mark as modified since we're ensuring all references are valid
            };
          }
          return cell;
        });
      });

      // Update languoids and rowToIdMap
      setLanguoids(prev => ({ ...prev, ...newLanguoids }));
      setRowToIdMap(prev => ({ ...prev, ...newRowToIdMap }));

      // After processing all rows and columns
      setTimeout(() => {
        setIsAddingFamilyEntries(false);
        // Trigger a re-check of invalid languoids
        setCanAddFamilyEntries(false);
      }, 500);

      return newData;
    });
  };

  // Helper to create a blank languoid with default values
  const createBlankLanguoid = () => {
    // Get structure from first languoid in the data, or use empty object if none exist
    const template = Object.values(languoids)[0] || {};
    
    // Create blank languoid with same keys but empty values
    return Object.keys(template).reduce((blank, key) => {
      const originalValue = template[key];
      
      // Set appropriate blank value based on the type of the original
      if (Array.isArray(originalValue)) {
        blank[key] = [];
      } else if (originalValue === null) {
        blank[key] = null;
      } else if (typeof originalValue === 'object') {
        blank[key] = null;  // or {} depending on your needs
      } else if (typeof originalValue === 'number') {
        blank[key] = 0;     // or null depending on your needs
      } else {
        blank[key] = '';
      }
      return blank;
    }, {});
  };

  return (
      <div className="spreadsheet-container">
        <button onClick={() => {
          if (hasUnsavedChanges()) {
            const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
            if (confirmClose) {
              onClose();
            }
          } else {
            onClose();
          }
        }} className="close-btn">&times;</button>
        <div className="spreadsheet-header">
          <h2 className="spreadsheet-title">{title}</h2>
          <div className="button-container">
            <button
              onClick={handleUpdate}
              disabled={Object.values(modifiedCells).filter(cell => cell && cell.modified === true).length === 0}
              className="update-btn"
            >
              Update
            </button>
            {canGenerateGlottocodes && (
              <button
                onClick={generateGlottocodes}
                className={`action-button generate-glottocodes ${isGeneratingGlottocodes ? 'pressed' : ''}`}
                disabled={isGeneratingGlottocodes}
              >
                Generate Glottocodes
              </button>
            )}
            {canAddFamilyEntries && (
              <button
                onClick={addFamilyEntries}
                className={`action-button add-family-entries ${isAddingFamilyEntries ? 'pressed' : ''}`}
                disabled={isAddingFamilyEntries}
              >
                Add Entries for Families
              </button>
            )}
          </div>
        </div>
        {isLoading ? (
          <div>Loading...</div>
        ) : data.length > 0 ? (
          <>
            <SpreadsheetWithStatus
              data={data}
              statusGetter={getRowStatus}
              onKeyDown={handleKeyDown}
              onChange={handleChange}
              onModeChange={handleModeChange}
              // onPaste={handlePaste}
              onSelect={(selection) => {
                console.log('Selection changed:', selection);
                if (isEditing && activeCell) {
                  applyChange(activeCell.row, activeCell.column);
                }
                if (selection && selection?.range?.start) {
                  setActiveCell(selection?.range?.start);
                  console.log('Set active cell:', selection?.range?.start);
                } else {
                  setActiveCell(null);
                  console.log('Cleared active cell');
                }
              }}
              columnLabels={visibleColumnInfo.map(col => col.label)}
              DataEditor={CustomDataEditor}
            />
            <AddRowsSection 
              rowsToAdd={rowsToAdd}
              setRowsToAdd={setRowsToAdd}
              handleAddRows={handleAddRows}
            />
          </>
        ) : (
          <div>No data available</div>
        )}
        {showWarning && (
          <WarningOverlay
            title="Warning: Invalid rows"
            message="Please fix the invalid cells before updating."
            invalidRows={invalidRows}
            onClose={() => setShowWarning(false)}
          />
        )}
      </div>
  );
};

export default LanguoidSheet;