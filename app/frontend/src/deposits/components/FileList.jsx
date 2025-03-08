import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FileList.css';

const FileList = ({ depositId, deposit }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await axios.get(`/api/v1/deposits/${depositId}/files/`);
        setFiles(response.data.results || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching files:', err);
        setError('Failed to load files: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    if (depositId) {
      fetchFiles();
    }
  }, [depositId]);
  
  const handleFileUpload = async (event) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles.length) return;
    
    setUploading(true);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deposit', depositId);
      formData.append('filename', file.name);
      
      try {
        await axios.post(`/api/v1/deposits/${depositId}/files/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: percentCompleted
            }));
          }
        });
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        setError(`Failed to upload ${file.name}: ${err.response?.data?.error || err.message}`);
      }
    }
    
    // Refresh file list
    try {
      const response = await axios.get(`/api/v1/deposits/${depositId}/files/`);
      setFiles(response.data.results || []);
    } catch (err) {
      console.error('Error refreshing files:', err);
    }
    
    setUploading(false);
    setUploadProgress({});
  };
  
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      // Create a fake event object with the dropped files
      const fakeEvent = {
        target: {
          files: event.dataTransfer.files
        }
      };
      handleFileUpload(fakeEvent);
    }
  };
  
  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    
    // Return appropriate icon based on file type
    switch(extension) {
      case 'pdf':
        return <i className="fas fa-file-pdf"></i>;
      case 'doc':
      case 'docx':
        return <i className="fas fa-file-word"></i>;
      case 'xls':
      case 'xlsx':
        return <i className="fas fa-file-excel"></i>;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <i className="fas fa-file-image"></i>;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <i className="fas fa-file-audio"></i>;
      case 'mp4':
      case 'mov':
      case 'avi':
        return <i className="fas fa-file-video"></i>;
      case 'json':
        return <i className="fas fa-file-code"></i>;
      default:
        return <i className="fas fa-file"></i>;
    }
  };
  
  const getFileType = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    
    // Map extensions to readable types
    const typeMap = {
      'pdf': 'PDF Document',
      'doc': 'Word Document',
      'docx': 'Word Document',
      'xls': 'Excel Spreadsheet',
      'xlsx': 'Excel Spreadsheet',
      'jpg': 'Image',
      'jpeg': 'Image',
      'png': 'Image',
      'gif': 'Image',
      'mp3': 'Audio',
      'wav': 'Audio',
      'ogg': 'Audio',
      'mp4': 'Video',
      'mov': 'Video',
      'avi': 'Video',
      'json': 'JSON Data',
      'txt': 'Text File',
      'csv': 'CSV Data'
    };
    
    return typeMap[extension] || `${extension.toUpperCase()} File`;
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  if (loading) {
    return <div className="loading">Loading files...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  return (
    <div className="file-list-container">
      {/* Drag and drop area */}
      <div 
        className="file-upload-area"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="upload-icon">
          <i className="fas fa-cloud-upload-alt"></i>
        </div>
        <p>Drag and drop files here or</p>
        <label className="upload-button">
          Browse Files
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Modern file list table */}
      {files.length > 0 && (
        <div className="modern-file-table">
          <div className="table-header">
            <div className="filename-col">Filename</div>
            <div className="filetype-col">Type</div>
            <div className="filesize-col">Size</div>
            <div className="status-col">Status</div>
            <div className="actions-col">Actions</div>
          </div>
          
          <div className="table-body">
            {files.map(file => (
              <div key={file.id} className="file-row">
                <div className="filename-col">
                  <span className="file-icon">
                    {getFileIcon(file.filename)}
                  </span>
                  <span className="file-name">{file.filename}</span>
                </div>
                <div className="filetype-col">{getFileType(file.filename)}</div>
                <div className="filesize-col">{formatFileSize(file.filesize)}</div>
                <div className="status-col">
                  {uploadProgress[file.filename] !== undefined ? (
                    <div className="progress-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${uploadProgress[file.filename]}%` }}
                      ></div>
                      <span className="progress-text">{uploadProgress[file.filename]}%</span>
                    </div>
                  ) : (
                    file.is_metadata_file ? (
                      <span className="metadata-badge">Metadata</span>
                    ) : (
                      <span className="complete-badge">Complete</span>
                    )
                  )}
                </div>
                <div className="actions-col">
                  {!file.is_metadata_file && (
                    <>
                      <button 
                        className="action-button metadata-button" 
                        onClick={() => handleSetAsMetadata(file.id)}
                        title="Set as metadata file"
                      >
                        <i className="fas fa-file-code"></i>
                      </button>
                      <button 
                        className="action-button delete-button" 
                        onClick={() => handleDeleteFile(file.id)}
                        title="Delete file"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default FileList; 