import React, { useState } from 'react';
import { useDeposit } from '../contexts/DepositContext';
import './NavigationTree.css';

const NavigationTree = ({ onSelectItem }) => {
  const { deposit, collections, unassociatedFiles, loading } = useDeposit();
  const [expandedCollections, setExpandedCollections] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  
  // If still loading, show loading state
  if (loading) {
    return (
      <div className="navigation-tree">
        <div className="tree-header">
          <h2 className="tree-title">Deposit Structure</h2>
        </div>
        <div className="tree-content">
          <div className="loading-message">Loading deposit data...</div>
        </div>
      </div>
    );
  }
  
  // If deposit is null or undefined, show error state
  if (!deposit) {
    return (
      <div className="navigation-tree">
        <div className="tree-header">
          <h2 className="tree-title">Deposit Structure</h2>
        </div>
        <div className="tree-content">
          <div className="error-message">No deposit data available</div>
        </div>
      </div>
    );
  }
  
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
  
  // Add a click handler for the node text
  const handleNodeTextClick = (node, e) => {
    e.stopPropagation(); // Prevent triggering the expand/collapse
    onSelectItem(node);
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
                    <span 
                      className="node-label" 
                      title={collection.name}
                      onClick={(e) => handleNodeTextClick({
                        type: 'collection',
                        uuid: collection.uuid,
                        name: collection.name || collection.collection_abbr || `Collection ${collection.uuid}`,
                        collection_abbr: collection.collection_abbr,
                        description: collection.description
                      }, e)}
                    >
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
                            <span 
                              className="node-label" 
                              title={`${item.catalog_number} - ${item.resource_type}`}
                              onClick={(e) => handleNodeTextClick({
                                type: 'item',
                                uuid: item.uuid,
                                catalog_number: item.catalog_number,
                                title: item.title,
                                description: item.description,
                                languoid: item.languoid,
                                date_recorded: item.date_recorded,
                                resource_type: item.resource_type
                              }, e)}
                            >
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
                                    <span 
                                      className="node-label" 
                                      title={`${file.filename} (${formatFileSize(file.filesize)})`}
                                      onClick={(e) => handleNodeTextClick({
                                        type: 'file',
                                        uuid: file.uuid,
                                        filename: file.filename,
                                        filesize: file.filesize,
                                        mime_type: file.mime_type,
                                        file_type: file.file_type,
                                        description: file.description,
                                        is_metadata: file.is_metadata
                                      }, e)}
                                    >
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
                    <span 
                      className="node-label" 
                      title={`${file.filename} (${formatFileSize(file.filesize)})`}
                      onClick={(e) => handleNodeTextClick({
                        type: 'file',
                        uuid: file.uuid,
                        filename: file.filename,
                        filesize: file.filesize,
                        mime_type: file.mime_type,
                        file_type: file.file_type,
                        description: file.description,
                        is_metadata: file.is_metadata
                      }, e)}
                    >
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