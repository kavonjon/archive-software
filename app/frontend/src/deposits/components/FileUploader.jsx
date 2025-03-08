import React, { useState } from 'react';
import axios from 'axios';

const FileUploader = ({ depositId, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('deposit', depositId);

    setUploading(true);
    setError('');

    try {
      const response = await axios.post('/api/v1/uploads/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        }
      });
      
      if (onUploadSuccess) onUploadSuccess(response.data);
      setFile(null);
    } catch (err) {
      setError('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files[0])} 
          disabled={uploading}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload File'}
      </button>
    </form>
  );
};

export default FileUploader; 