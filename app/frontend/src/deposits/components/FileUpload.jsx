import React, { useState } from 'react';
import { useDeposit } from '../contexts/DepositContext';
import './FileUpload.css';

const FileUpload = () => {
  const { depositId, uploadFile } = useDeposit();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select files to upload');
      return;
    }

    setUploading(true);
    setUploadProgress({});
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // Upload each file individually
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Create a progress tracker for this file
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 0
        }));
        
        // Upload with progress tracking
        const formData = new FormData();
        formData.append('file', file);
        await uploadFile(formData, (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: percentCompleted
          }));
        });
      }
      
      setUploadSuccess(true);
      setSelectedFiles([]);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Render the component UI
  return (
    <div className="file-upload">
      <h3>Upload Files</h3>
      
      <div className="upload-form">
        <input 
          type="file" 
          multiple 
          onChange={handleFileChange} 
          disabled={uploading}
        />
        <button 
          onClick={handleUpload} 
          disabled={uploading || selectedFiles.length === 0}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      
      {/* Display selected files */}
      {selectedFiles.length > 0 && (
        <div className="selected-files">
          <h4>Selected Files:</h4>
          <ul>
            {selectedFiles.map(file => (
              <li key={file.name}>
                {file.name} ({Math.round(file.size / 1024)} KB)
                {uploading && uploadProgress[file.name] !== undefined && (
                  <div className="progress-bar">
                    <div 
                      className="progress" 
                      style={{ width: `${uploadProgress[file.name]}%` }}
                    ></div>
                    <span>{uploadProgress[file.name]}%</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Display error message */}
      {uploadError && (
        <div className="error-message">
          {uploadError}
        </div>
      )}
      
      {/* Display success message */}
      {uploadSuccess && (
        <div className="success-message">
          Files uploaded successfully!
        </div>
      )}
    </div>
  );
};

export default FileUpload; 