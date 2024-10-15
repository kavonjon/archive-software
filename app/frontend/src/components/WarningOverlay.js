import React from 'react';

const WarningOverlay = ({ title, message, invalidRows, onClose }) => {
  return (
    <div className="warning-overlay">
      <div className="warning-content">
        <h2>{title}</h2>
        <p>{message}</p>
        <h3>Invalid Rows:</h3>
        <ul>
          {invalidRows.map((row, index) => (
            <li key={index}>Row {row.rowNumber}: {row.name} ({row.glottocode})</li>
          ))}
        </ul>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default WarningOverlay;