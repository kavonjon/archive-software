// src/components/ParentLanguoidSelector.js
import React from 'react';
import Select from 'react-select';

const ParentLanguoidSelector = ({ value, onChange, options }) => {
  return (
    <Select
      isMulti={false}
      value={value}
      onChange={onChange}
      options={options}
      className="react-select-container"
      classNamePrefix="react-select"
      placeholder="Select Parent Languoid..."
      isSearchable
    />
  );
};

export default ParentLanguoidSelector;
