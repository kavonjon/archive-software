import React, { useState, useEffect } from 'react';
import { Grid, Input, Select } from 'react-spreadsheet-grid';
import axios from 'axios';
import { produce } from 'immer';
import { ChildDialectSelector, SingleLanguoidSelector } from './LanguoidSelectors';
import './LanguoidSheet.css';

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
      setRows(convertLanguoidsToSpreadsheetData(processedData));
      setSavedData(convertLanguoidsToSpreadsheetData(processedData));      
      console.log("Fetched languoids:", processedData);
    } catch (error) {
      console.error("Error fetching languoids:", error);
    }
  };

  const convertLanguoidsToSpreadsheetData = (languoids) => {
    return languoids.map((languoid, rowIndex) => ({
      id: rowIndex,
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

  const handleChange = (rowId, field, value) => {
    setRows(produce(draft => {
      const row = draft.find(r => r.id === rowId);
      if (row) {
        row[field] = value;
      }
    }));

    setModifiedCells(produce(draft => {
      draft[`${rowId}-${field}`] = true;
    }));
  };

  const handleUpdate = async () => {
    try {
      console.log('Updating rows...');
      await axios.put('/api/update-languages/', rows);
      console.log('Update successful.');
      setModifiedCells({});
    } catch (error) {
      console.error('Error updating data:', error);
    }
  };

  const columns = [
    {
      id: 'glottocode',
      title: 'Glottocode',
      value: (row, { focus }) => (
        <Input
          value={row.glottocode}
          focus={focus}
          onChange={value => handleChange(row.id, 'glottocode', value)}
        />
      )
    },
    {
      id: 'iso',
      title: 'ISO Code',
      value: (row, { focus }) => (
        <Input
          value={row.iso}
          focus={focus}
          onChange={value => handleChange(row.id, 'iso', value)}
        />
      )
    },
    {
      id: 'name',
      title: 'Name',
      value: (row, { focus }) => (
        <Input
          value={row.name}
          focus={focus}
          onChange={value => handleChange(row.id, 'name', value)}
        />
      )
    },
    {
      id: 'dialects_languoids',
      title: 'Dialects Languoids',
      value: (row, { focus }) => (
        <ChildDialectSelector
          value={row.dialects_languoids}
          focus={focus}
          onChange={value => handleChange(row.id, 'dialects_languoids', value)}
          allLanguoids={languoids}
        />
      )
    },
    {
      id: 'family_languoid',
      title: 'Family Languoid',
      value: (row, { focus }) => (
        <SingleLanguoidSelector
          value={row.family_languoid}
          focus={focus}
          onChange={value => handleChange(row.id, 'family_languoid', value)}
          allLanguoids={languoids}
        />
      )
    },
    {
      id: 'pri_subgroup_languoid',
      title: 'Primary Subgroup Languoid',
      value: (row, { focus }) => (
        <SingleLanguoidSelector
          value={row.pri_subgroup_languoid}
          focus={focus}
          onChange={value => handleChange(row.id, 'pri_subgroup_languoid', value)}
          allLanguoids={languoids}
        />
      )
    },
    {
      id: 'sec_subgroup_languoid',
      title: 'Secondary Subgroup Languoid',
      value: (row, { focus }) => (
        <SingleLanguoidSelector
          value={row.sec_subgroup_languoid}
          focus={focus}
          onChange={value => handleChange(row.id, 'sec_subgroup_languoid', value)}
          allLanguoids={languoids}
        />
      )
    },
    {
      id: 'parent_languoid',
      title: 'Parent Languoid',
      value: (row, { focus }) => (
        <SingleLanguoidSelector
          value={row.parent_languoid}
          focus={focus}
          onChange={value => handleChange(row.id, 'parent_languoid', value)}
          allLanguoids={languoids}
        />
      )
    },
    {
      id: 'language_languoid',
      title: 'Language Languoid',
      value: (row, { focus }) => (
        <SingleLanguoidSelector
          value={row.language_languoid}
          focus={focus}
          onChange={value => handleChange(row.id, 'language_languoid', value)}
          allLanguoids={languoids}
        />
      )
    },
    {
      id: 'alt_name',
      title: 'Alternative Name(s)',
      value: (row, { focus }) => (
        <Input
          value={row.alt_name}
          focus={focus}
          onChange={value => handleChange(row.id, 'alt_name', value)}
        />
      )
    },
    {
      id: 'region',
      title: 'Region',
      value: (row, { focus }) => (
        <Input
          value={row.region}
          focus={focus}
          onChange={value => handleChange(row.id, 'region', value)}
        />
      )
    },
    {
      id: 'tribes',
      title: 'Tribe(s)',
      value: (row, { focus }) => (
        <Input
          value={row.tribes}
          focus={focus}
          onChange={value => handleChange(row.id, 'tribes', value)}
        />
      )
    },
    {
      id: 'notes',
      title: 'Notes',
      value: (row, { focus }) => (
        <Input
          value={row.notes}
          focus={focus}
          onChange={value => handleChange(row.id, 'notes', value)}
        />
      )
    },
  ];

  return (
    <ErrorBoundary>
      <div className="languoid-sheet-container">
        <div className="languoid-sheet-header">
          <button onClick={handleUpdate}>Update</button>
        </div>
        {rows.length > 0 ? (
          <div className="grid-container">
            <Grid
              columns={columns}
              rows={rows}
              getRowKey={row => row.id}
              rowHeight={35}
              headerHeight={40}
              isColumnsResizable
              onCellClick={(rowId, columnId) => console.log('Cell clicked:', rowId, columnId)}
              cellClassName={(row, columnId) => 
                modifiedCells[`${row.id}-${columnId}`] ? 'modified-cell' : ''
              }
              // Remove the columnWidthValues prop
            />
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default LanguoidSheet;