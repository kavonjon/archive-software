import React, { useState, useEffect } from 'react';
import DataGrid from 'react-data-grid';
import axios from 'axios';
import { produce } from 'immer';
import { ChildDialectSelector, SingleLanguoidSelector } from './LanguoidSelectors';
import 'react-data-grid/lib/styles.css';
import { textEditor } from 'react-data-grid';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.log('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children; 
  }
}

const COLUMN_INDICES = {
  GLOTTOCODE: 0,
  ISO_CODE: 1,
  NAME: 2,
  DIALECTS_LANGUOIDS: 3,
  FAMILY_LANGUOID: 4,
  PRI_SUBGROUP_LANGUOID: 5,
  SEC_SUBGROUP_LANGUOID: 6,
  PARENT_LANGUOID: 7,
  LANGUAGE_LANGUOID: 8,
  ALT_NAME: 9,
  REGION: 10,
  TRIBES: 11,
  NOTES: 12,
};

const LanguoidSheet = () => {
  const [languoids, setLanguoids] = useState([]);
  const [rows, setRows] = useState([]);
  const [savedData, setSavedData] = useState([]);
  const [modifiedCells, setModifiedCells] = useState({});
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    fetchLanguoids();
  }, []);

  useEffect(() => {
    console.log('Updated modifiedCells:', modifiedCells);
  }, [modifiedCells]);

  const fetchLanguoids = async () => {
    try {
      const response = await axios.get('/api/languages/');
      let processedData = response.data.map(languoid => ({
        ...languoid,
        dialects_languoids: Array.isArray(languoid.dialects_languoids)
          ? languoid.dialects_languoids
          : []
      }));
      // Take the first 10 rows of processedData
      const limitedProcessedData = processedData.slice(0, 10);
      processedData = limitedProcessedData;
      setLanguoids(processedData);
      setRows(convertLanguoidsToRows(processedData));
      setSavedData(convertLanguoidsToRows(processedData));      
      console.log("Fetched languoids:", processedData);
    } catch (error) {
      console.error("Error fetching languoids:", error);
    }
  };

  const convertLanguoidsToRows = (languoids) => {
    return languoids.map((languoid, index) => ({
      id: index,
      glottocode: languoid.glottocode || '',
      iso: languoid.iso || '',
      name: languoid.name || '',
      dialects_languoids: languoid.dialects_languoids.map(d => d.name).join(', ') || '',
      family_languoid: languoid.family_languoid?.name || '',
      pri_subgroup_languoid: languoid.pri_subgroup_languoid?.name || '',
      sec_subgroup_languoid: languoid.sec_subgroup_languoid?.name || '',
      parent_languoid: languoid.parent_languoid?.name || '',
      language_languoid: languoid.language_languoid?.name || '',
      alt_name: languoid.alt_name || '',
      region: languoid.region || '',
      tribes: languoid.tribes || '',
      notes: languoid.notes || '',
    }));
  };

  const handleChange = (newRows, { indexes, column }) => {
    const changes = indexes.map(index => ({
      rowIndex: index,
      columnKey: column.key,
      newValue: newRows[index][column.key]
    }));

    changes.forEach(({ rowIndex, columnKey, newValue }) => {
      setModifiedCells(prev => ({
        ...prev,
        [`${rowIndex}-${columnKey}`]: true
      }));

      setRows(produce(draft => {
        draft[rowIndex][columnKey] = newValue;
      }));
    });

    console.log('Modified cells:', modifiedCells);
  };

  const handlePaste = ({ sourceColumnKey, sourceRow, targetColumnKey, targetRow }) => {
    const newValue = sourceRow[sourceColumnKey];
    setRows(produce(draft => {
      draft[targetRow.id][targetColumnKey] = newValue;
    }));
    setModifiedCells(prev => ({
      ...prev,
      [`${targetRow.id}-${targetColumnKey}`]: true
    }));
  };

  const handleUpdate = async () => {
    try {
      console.log('Updating rows...');
      await axios.put('/api/update-languages/', languoids);
      console.log('Update successful.');
      setModifiedCells({}); // Reset the modified cells after update
    } catch (error) {
      console.error('Error updating data:', error);
    }
  };

  const cellRenderer = ({ row, column }) => {
    const value = row[column.key];
    const isModified = modifiedCells[`${row.id}-${column.key}`];
    return (
      <div style={isModified ? { backgroundColor: 'rgba(144, 238, 144, 0.5)' } : {}}>
        {value}
      </div>
    );
  };

  const columns = [
    { key: 'glottocode', name: 'Glottocode', cellRenderer, editable: true },
    { key: 'iso', name: 'ISO Code', cellRenderer, editable: true },
    { key: 'name', name: 'Name', cellRenderer, editable: true },
    { 
      key: 'dialects_languoids', 
      name: 'Dialects Languoids', 
      cellRenderer,
      editor: ChildDialectSelector,
      editorProps: {
        allLanguoids: languoids
      }
    },
    { 
      key: 'family_languoid', 
      name: 'Family Languoid', 
      cellRenderer,
      editor: SingleLanguoidSelector,
      editorProps: {
        allLanguoids: languoids
      }
    },
    { 
      key: 'pri_subgroup_languoid', 
      name: 'Primary Subgroup Languoid', 
      cellRenderer,
      editor: SingleLanguoidSelector,
      editorProps: {
        allLanguoids: languoids
      }
    },
    { 
      key: 'sec_subgroup_languoid', 
      name: 'Secondary Subgroup Languoid', 
      cellRenderer,
      editor: SingleLanguoidSelector,
      editorProps: {
        allLanguoids: languoids
      }
    },
    { 
      key: 'parent_languoid', 
      name: 'Parent Languoid', 
      cellRenderer,
      editor: SingleLanguoidSelector,
      editorProps: {
        allLanguoids: languoids
      }
    },
    { 
      key: 'language_languoid', 
      name: 'Language Languoid', 
      cellRenderer,
      editor: SingleLanguoidSelector,
      editorProps: {
        allLanguoids: languoids
      }
    },
    { key: 'alt_name', name: 'Alternative Name(s)', cellRenderer, editable: true },
    { key: 'region', name: 'Region', cellRenderer, editable: true },
    { key: 'tribes', name: 'Tribe(s)', cellRenderer, editable: true },
    { key: 'notes', name: 'Notes', editor: textEditor, editable: true },
  ];

  const gridStyle = {
    minHeight: '500px', // Adjust as needed
    width: '100%',
  };

  console.log('Rendering DataGrid with rows:', rows);

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={handleUpdate}>Update</button>
      </div>
      <div onClick={() => console.log('Outer div clicked')} style={{ width: '100%', height: '500px' }}>
        {rows.length > 0 ? (
          <DataGrid
            columns={columns}
            rows={rows}
            onRowsChange={handleChange}
            onPaste={handlePaste}
            onSelectedCellChange={setSelectedCell}
            style={gridStyle}
            headerRowHeight={45}
            rowHeight={35}
            onCellClick={(args) => console.log('Cell clicked:', args)}
          />
        ) : (
          <div>Loading...</div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default LanguoidSheet;