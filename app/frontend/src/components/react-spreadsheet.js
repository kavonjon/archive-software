import React, { useState, useEffect } from 'react';
import Spreadsheet, { DataViewer } from 'react-spreadsheet';
import axios from 'axios';
import { produce } from 'immer';

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
  const [data, setData] = useState([]);
  const [savedData, setSavedData] = useState([]);
  const [modifiedCells, setModifiedCells] = useState({}); // Track modified cells
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
      setData(convertLanguoidsToSpreadsheetData(processedData));
      setSavedData(convertLanguoidsToSpreadsheetData(processedData));      
      console.log("Fetched languoids:", processedData);
    } catch (error) {
      console.error("Error fetching languoids:", error);
    }
  };

  const convertLanguoidsToSpreadsheetData = (languoids) => {
    return languoids.map((languoid, rowIndex) => [
      { value: languoid.glottocode || '' },  // Glottocode
      { value: languoid.iso || '' },         // ISO Code
      { value: languoid.name || '' },        // Name
      { value: languoid.dialects_languoids.map(d => d.name).join(', ') || '' },  // Dialects Languoids
      { value: languoid.family_languoid?.name || '' },  // Family Languoid
      { value: languoid.pri_subgroup_languoid?.name || '' },  // Primary Subgroup Languoid
      { value: languoid.sec_subgroup_languoid?.name || '' },  // Secondary Subgroup Languoid
      { value: languoid.parent_languoid?.name || '' },  // Parent Languoid
      { value: languoid.language_languoid?.name || '' },  // Language Languoid
      { value: languoid.alt_name || '' }, // Alternative Name(s)
      { value: languoid.region || '' }, // Region
      { value: languoid.tribes || '' }, // Tribes
      { value: languoid.notes || '' }, // Notes
    ]);
  };

  const handleChange = (changes) => {
    console.log('Received changes:', changes);
    
    changes.forEach((rowArray, rowIndex) => {
      if (Array.isArray(rowArray)) {
        rowArray.forEach((cell, columnIndex) => {
          if (cell && cell.value !== undefined) {
            const oldValue = savedData[rowIndex]?.[columnIndex]?.value; // Get old value
  
            // Compare old value and new value
            if (cell.value !== oldValue) {
              console.log(`Cell at row ${rowIndex}, column ${columnIndex} changed from "${oldValue}" to "${cell.value}".`);
  
              // Mark this cell as modified only if it's actually changed
              setModifiedCells(prevModifiedCells => ({
                ...prevModifiedCells,
                [`${rowIndex}-${columnIndex}`]: true
              }));
  
              // // Update languoids state
              // setLanguoids(produce(draft => {
              //   draft[rowIndex][columnIndex] = cell.value; // Update the specific cell in languoids
              // }));
  
              // Update spreadsheet data (rendering)
              setData(produce(draft => {
                draft[rowIndex][columnIndex] = { 
                  value: cell.value,
                  isModified: true
                };
              }));
            } else {
              setModifiedCells(prevModifiedCells => ({
                ...prevModifiedCells,
                [`${rowIndex}-${columnIndex}`]: false
              }));
              console.log(`No change detected at row ${rowIndex}, column ${columnIndex}.`);
            }
          } else {
            console.error(`Invalid cell or value in change detected at row ${rowIndex}, column ${columnIndex}`);
          }
        });
      } else {
        console.error('Invalid row structure detected in changes:', rowArray);
      }
    });
  
    console.log('Modified cells:', modifiedCells);
  };
  
  

  const handlePaste = (copiedData) => {
    console.log('Pasted data:', copiedData);
    const changes = [];
    const startRow = selectedCell ? selectedCell.r : 0;
    const startCol = selectedCell ? selectedCell.c : 0;

    copiedData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const targetColumn = startCol + colIndex;
        let value = cell.value;
        if (targetColumn === COLUMN_INDICES.DIALECTS_LANGUOIDS) {
          value = value.split(',').map(name => name.trim()).join(', ');
        }
        if (targetColumn !== COLUMN_INDICES.GLOTTOCODE) {
          changes.push({
            row: startRow + rowIndex,
            column: targetColumn,
            value: value
          });
        }
      });
    });

    handleChange(changes);
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

  // Add a class to modified cells to change their background color
  const getCellProps = (cell, rowIndex, columnIndex) => {
    console.log('modifiepenisssss');
    const isModified = modifiedCells[`${rowIndex}-${columnIndex}`];
    // console.log(`Checking cell at row ${rowIndex}, column ${columnIndex}: modified=${isModified}`);
    if (isModified) {
      return {
        className: 'modified-cell',
      };
    }
    return {};
  };

  const CustomCell = ({ cell, ...props }) => (
    <Cell {...props}>
      <div style={cell.isModified ? { backgroundColor: 'rgba(144, 238, 144, 0.5)' } : {}}>
        {cell.value}
      </div>
    </Cell>
  );

  const CustomDataViewer = ({ cell, ...props }) => (
    <DataViewer {...props}>
      <div style={cell.isModified ? { backgroundColor: 'rgba(144, 238, 144, 0.5)' } : {}}>
        {cell.value}
      </div>
    </DataViewer>
  );

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={handleUpdate}>Update</button>
      </div>
      {data.length > 0 ? (
        <Spreadsheet
          data={data}
          onChange={handleChange}
          onPaste={handlePaste}
          onSelect={(cell) => setSelectedCell(cell)} // Make sure selectedCell is updated
          columnLabels={[
            'Glottocode',
            'ISO Code',
            'Name',
            'Dialects Languoids',
            'Family Languoid',
            'Primary Subgroup Languoid',
            'Secondary Subgroup Languoid',
            'Parent Languoid',
            'Language Languoid',
            'Alternative Name(s)',
            'Region',
            'Tribe(s)',
            'Notes'
          ]}
          // getCellProps={getCellProps} // Pass custom props to the cells
          DataViewer={CustomDataViewer}
        />
      ) : (
        <div>Loading...</div>
      )}

      <style>{`
        .modified-cell {
          background-color: rgba(0, 255, 0, 0.3); /* Semi-transparent green */
        }
      `}</style>
    </ErrorBoundary>
  );
};

export default LanguoidSheet;
