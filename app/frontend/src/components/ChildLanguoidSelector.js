// src/components/ChildSelector.js
import React from 'react';
import Select from 'react-select';

const ChildLanguoidSelector = ({ value, onChange, options }) => {
  return (
    <Select
      isMulti
      value={value}
      onChange={onChange}
      options={options}
      className="react-select-container"
      classNamePrefix="react-select"
      placeholder="Select Child Languoids..."
      isSearchable
    />
  );
};

export default ChildLanguoidSelector;
