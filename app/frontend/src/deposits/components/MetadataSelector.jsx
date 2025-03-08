import React, { useState } from 'react';
import axios from 'axios';

const MetadataSelector = ({ file, onSuccess }) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const markAsMetadata = async () => {
    setProcessing(true);
    setError('');

    try {
      const response = await axios.post(
        `/api/v1/uploads/${file.id}/set_as_metadata/`, 
        {},
        {
          headers: {
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
          }
        }
      );
      
      if (onSuccess) onSuccess(response.data);
    } catch (err) {
      setError('Failed to set as metadata: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <button 
        onClick={markAsMetadata} 
        disabled={processing || file.is_metadata_file}
      >
        {file.is_metadata_file ? 'Metadata File' : 'Set as Metadata'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default MetadataSelector; 