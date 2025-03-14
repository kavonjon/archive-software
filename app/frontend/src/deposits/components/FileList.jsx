import React, { useState } from 'react';
import { useDeposit } from '../contexts/DepositContext';
import FileUpload from './FileUpload';
import './FileList.css';

const FileList = ({ selectedItem }) => {
  const { 
    files, 
    loading, 
    error, 
    uploadFile, 
    associateFile, 
    markAsMetadata,
    refreshData
  } = useDeposit();
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sortField, setSortField] = useState('filename');
  const [sortDirection, setSortDirection] = useState('asc');
  
  console.log("FileList rendering with files:", files);
  
  if (loading) {
    return <div className="loading-message">Loading files...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  if (!files || files.length === 0) {
    return (
      <div className="file-list-container">
        <div className="upload-only-container">
          <FileUpload onUploadComplete={refreshData} />
        </div>
        <div className="empty-message">
          No files have been uploaded yet.
        </div>
      </div>
    );
  }
  
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const sortedFiles = (Array.isArray(files) ? [...files] : []).sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'filename':
        comparison = a.filename.localeCompare(b.filename);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'uploaded':
        comparison = new Date(a.created_at) - new Date(b.created_at);
        break;
      case 'type':
        comparison = a.content_type.localeCompare(b.content_type);
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedFiles(sortedFiles.map(file => file.id));
    } else {
      setSelectedFiles([]);
    }
  };
  
  const handleSelectFile = (fileId) => {
    if (selectedFiles.includes(fileId)) {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    } else {
      setSelectedFiles([...selectedFiles, fileId]);
    }
  };
  
  const handleAssociateFiles = () => {
    if (selectedItem && selectedFiles.length > 0) {
      // Call the associateFile function for each selected file
      Promise.all(selectedFiles.map(fileId => associateFile(fileId, selectedItem.id)))
        .then(() => {
          // Clear selection after association
          setSelectedFiles([]);
          // Refresh data
          refreshData();
        });
    }
  };
  
  const handleMarkAsMetadata = () => {
    if (selectedFiles.length === 1) {
      markAsMetadata(selectedFiles[0])
        .then(() => {
          // Clear selection after marking
          setSelectedFiles([]);
          // Refresh data
          refreshData();
        });
    }
  };
  
  return (
    <div className="file-list-container">
      <div className="upload-only-container">
        <FileUpload onUploadComplete={refreshData} />
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="file-actions">
          {selectedItem && (
            <button 
              className="associate-button"
              onClick={handleAssociateFiles}
            >
              Associate with {selectedItem.name || 'Selected Item'}
            </button>
          )}
          
          {selectedFiles.length === 1 && (
            <button 
              className="metadata-button"
              onClick={handleMarkAsMetadata}
            >
              Mark as Metadata File
            </button>
          )}
        </div>
      )}
      
      <div className="file-list-table-container">
        <table className="file-list-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  onChange={handleSelectAll}
                  checked={selectedFiles.length === sortedFiles.length && sortedFiles.length > 0}
                />
              </th>
              <th 
                className={`sortable ${sortField === 'filename' ? 'sorted-' + sortDirection : ''}`}
                onClick={() => handleSort('filename')}
              >
                Filename
                {sortField === 'filename' && (
                  <span className="sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th 
                className={`sortable ${sortField === 'size' ? 'sorted-' + sortDirection : ''}`}
                onClick={() => handleSort('size')}
              >
                Size
                {sortField === 'size' && (
                  <span className="sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th 
                className={`sortable ${sortField === 'type' ? 'sorted-' + sortDirection : ''}`}
                onClick={() => handleSort('type')}
              >
                Type
                {sortField === 'type' && (
                  <span className="sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th 
                className={`sortable ${sortField === 'uploaded' ? 'sorted-' + sortDirection : ''}`}
                onClick={() => handleSort('uploaded')}
              >
                Uploaded
                {sortField === 'uploaded' && (
                  <span className="sort-indicator">
                    {sortDirection === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map(file => (
              <tr 
                key={file.id} 
                className={selectedFiles.includes(file.id) ? 'selected' : ''}
              >
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedFiles.includes(file.id)}
                    onChange={() => handleSelectFile(file.id)}
                  />
                </td>
                <td>
                  <span className="filename-cell" data-type={file.filename.split('.').pop().toLowerCase()}>
                    {file.filename}
                  </span>
                </td>
                <td>{formatFileSize(file.size)}</td>
                <td>{file.content_type}</td>
                <td>{new Date(file.created_at).toLocaleString()}</td>
                <td>
                  {file.is_metadata_file ? (
                    <span className="status-badge metadata-badge">Metadata</span>
                  ) : file.item_uuid ? (
                    <span className="status-badge associated-badge">Associated</span>
                  ) : (
                    <span className="status-badge unassociated-badge">Unassociated</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileList; 