import React, { useState } from 'react';
import './NavigationTree.css';

const NavigationTree = ({ deposit, onSelectItem }) => {
  const [expandedCollections, setExpandedCollections] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  
  // Get the actual deposit data or use sample data if not provided
  const depositData = deposit || {
    id: '123',
    title: 'Sample Deposit',
    metadata: {
      versions: [
        {
          version: 1,
          state: 'DRAFT',
          timestamp: '2024-04-01T12:00:00Z',
          modified_by: 'user@example.com',
          is_draft: true,
          data: {
            collections: [
              {}
               
            ]
          }
        }
      ]
    }
  };
  
  // Extract the latest version data from the metadata
  const latestVersion = depositData.metadata?.versions?.[0] || { data: {} };
  const collections = latestVersion.data?.collections || [];
  const unassociatedFiles = latestVersion.data?.unassociated_files || [];
  
  const toggleCollection = (collectionId) => {
    setExpandedCollections(prev => ({
      ...prev,
      [collectionId]: !prev[collectionId]
    }));
  };
  
  const toggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };
  
  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    
    switch (extension) {
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
      case 'csv':
        return <i className="fas fa-file-csv"></i>;
      case 'txt':
        return <i className="fas fa-file-alt"></i>;
      default:
        return <i className="fas fa-file"></i>;
    }
  };
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <div className="navigation-tree">
      <div className="tree-header">
        <h2 className="tree-title">Deposit Structure</h2>
      </div>
      
      <div className="tree-content">
        {/* Collections */}
        <div className="tree-section">
          <div className="section-header">
            <i className="fas fa-archive"></i>
            <span>Collections</span>
          </div>
          
          {collections.length === 0 ? (
            <div className="empty-message">No collections</div>
          ) : (
            <ul className="tree-list">
              {collections.map(collection => (
                <li key={collection.uuid} className="tree-item collection-item">
                  <div 
                    className="tree-node"
                    onClick={() => toggleCollection(collection.uuid)}
                  >
                    <span className="node-icon">
                      {expandedCollections[collection.uuid] ? 
                        <i className="fas fa-chevron-down"></i> : 
                        <i className="fas fa-chevron-right"></i>
                      }
                    </span>
                    <span className="node-icon collection-icon">
                      <i className="fas fa-folder"></i>
                    </span>
                    <span className="node-label" title={collection.name}>
                      {collection.name || collection.collection_abbr || `Collection ${collection.uuid}`}
                    </span>
                    <div className="node-indicators">
                      {collection.warn && (
                        <span className="warning-indicator" title="This collection has warnings">
                          <i className="fas fa-exclamation-triangle"></i>
                        </span>
                      )}
                      <span className="node-count">{collection.items?.length || 0}</span>
                    </div>
                  </div>
                  
                  {expandedCollections[collection.uuid] && collection.items && (
                    <ul className="tree-list nested">
                      {collection.items.map(item => (
                        <li key={item.uuid} className="tree-item item-item">
                          <div 
                            className="tree-node"
                            onClick={() => toggleItem(item.uuid)}
                          >
                            <span className="node-icon">
                              {expandedItems[item.uuid] ? 
                                <i className="fas fa-chevron-down"></i> : 
                                <i className="fas fa-chevron-right"></i>
                              }
                            </span>
                            <span className="node-icon item-icon">
                              <i className="fas fa-box"></i>
                            </span>
                            <span className="node-label" title={`${item.catalog_number} - ${item.resource_type}`}>
                              {item.catalog_number || `Item ${item.uuid}`}
                            </span>
                            <div className="node-indicators">
                              {item.warn && (
                                <span className="warning-indicator" title="This item has warnings">
                                  <i className="fas fa-exclamation-triangle"></i>
                                </span>
                              )}
                              <span className="node-count">{item.files?.length || 0}</span>
                            </div>
                          </div>
                          
                          {expandedItems[item.uuid] && item.files && (
                            <ul className="tree-list nested">
                              {item.files.map(file => (
                                <li 
                                  key={file.uuid} 
                                  className="tree-item file-item"
                                  onClick={() => onSelectItem && onSelectItem('file', file.uuid)}
                                >
                                  <div className="tree-node leaf">
                                    <span className="node-icon file-icon">
                                      {getFileIcon(file.filename)}
                                    </span>
                                    <span className="node-label" title={`${file.filename} (${formatFileSize(file.filesize)})`}>
                                      {file.filename}
                                    </span>
                                    {file.warn && (
                                      <span className="warning-indicator" title="This file has warnings">
                                        <i className="fas fa-exclamation-triangle"></i>
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Unassociated Files */}
        <div className="tree-section">
          <div className="section-header">
            <i className="fas fa-exclamation-triangle"></i>
            <span>Unassociated Files</span>
          </div>
          
          {unassociatedFiles.length === 0 ? (
            <div className="empty-message">No unassociated files</div>
          ) : (
            <ul className="tree-list">
              {unassociatedFiles.map(file => (
                <li 
                  key={file.uuid} 
                  className="tree-item file-item"
                  onClick={() => onSelectItem && onSelectItem('file', file.uuid)}
                >
                  <div className="tree-node leaf">
                    <span className="node-icon file-icon">
                      {getFileIcon(file.filename)}
                    </span>
                    <span className="node-label" title={`${file.filename} (${formatFileSize(file.filesize)})`}>
                      {file.filename}
                    </span>
                    {file.warn && (
                      <span className="warning-indicator" title="This file has warnings">
                        <i className="fas fa-exclamation-triangle"></i>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default NavigationTree; 