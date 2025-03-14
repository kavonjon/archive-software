import React, { useState, useRef } from 'react';
import { useDeposit } from '../contexts/DepositContext';
import './FileUpload.css';

const FileUpload = ({ onUploadComplete }) => {
  const { uploadFile, isUploading } = useDeposit();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);
  
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };
  
  const handleChange = (e) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };
  
  const handleFiles = (files) => {
    setSelectedFiles(Array.from(files));
  };
  
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setError(null);
    
    try {
      for (const file of selectedFiles) {
        const onProgress = (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: progress
          }));
        };
        
        await uploadFile(file, onProgress);
      }
      
      // Clear selected files after upload
      setSelectedFiles([]);
      setUploadProgress({});
      
      // Call the callback if provided
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload files. Please try again.');
    }
  };
  
  const openFileSelector = () => {
    fileInputRef.current.click();
  };
  
  const handleBrowseClick = (e) => {
    e.stopPropagation();
    openFileSelector();
  };
  
  return (
    <div className="file-upload-component">
      <div 
        className={`file-upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={openFileSelector}
      >
        <div className="upload-icon">
          <i className="fas fa-cloud-upload-alt"></i>
        </div>
        <p>
          Drag and drop files here, or 
          <button className="browse-button" onClick={handleBrowseClick}>Browse</button>
          <br />
          <span style={{ fontSize: '13px', color: '#78909c', marginTop: '5px', display: 'block' }}>
            Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, ZIP
          </span>
        </p>
        <input 
          ref={fileInputRef}
          type="file" 
          multiple 
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="selected-files">
          <h3>Selected Files ({selectedFiles.length})</h3>
          <ul className="file-list">
            {selectedFiles.map((file, index) => {
              // Determine file type icon based on extension
              const extension = file.name.split('.').pop().toLowerCase();
              let fileIcon = '📄'; // Default document icon
              
              if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(extension)) {
                fileIcon = '🖼️';
              } else if (['pdf'].includes(extension)) {
                fileIcon = '📕';
              } else if (['doc', 'docx'].includes(extension)) {
                fileIcon = '📝';
              } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
                fileIcon = '📊';
              } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
                fileIcon = '🗜️';
              }
              
              return (
                <li key={index} className="file-item">
                  <span style={{ marginRight: '8px', fontSize: '18px' }}>{fileIcon}</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024).toFixed(2)} KB)</span>
                  {uploadProgress[file.name] !== undefined && (
                    <div className="progress-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      ></div>
                      <span className="progress-text">{uploadProgress[file.name]}%</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button 
            className="upload-button"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload; 