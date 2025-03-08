import React, { useState } from 'react';
import FileList from './FileList';
import './ContentView.css';

const ContentView = ({ type, depositId, deposit }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  
  const renderFilesView = () => {
    return <FileList depositId={depositId} deposit={deposit} />;
  };
  
  const renderMetadataView = () => {
    return (
      <div className="metadata-view">
        <h2>Metadata Editor</h2>
        <p>Edit deposit metadata below:</p>
        
        <div className="metadata-form">
          <div className="form-group">
            <label>Title</label>
            <input 
              type="text" 
              value={deposit.title || ''} 
              onChange={() => {}} 
              placeholder="Enter deposit title"
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              value={deposit.description || ''} 
              onChange={() => {}} 
              placeholder="Enter deposit description"
            ></textarea>
          </div>
          
          <div className="form-group">
            <label>Access Level</label>
            <select value={deposit.access_level || ''} onChange={() => {}}>
              <option value="">Select access level</option>
              <option value="1">Level 1 - Public</option>
              <option value="2">Level 2 - Registered Users</option>
              <option value="3">Level 3 - Restricted</option>
            </select>
          </div>
          
          <button className="button save-button">Save Changes</button>
        </div>
      </div>
    );
  };
  
  const renderCollectionsView = () => {
    const collections = deposit?.metadata?.collections || [];
    
    return (
      <div className="collections-view">
        <h2>Collections</h2>
        
        {collections.length === 0 ? (
          <div className="empty-state">
            <p>No collections have been created yet.</p>
            <button className="button">Create New Collection</button>
          </div>
        ) : (
          <div className="collections-list">
            {collections.map(collection => (
              <div key={collection.uuid} className="collection-card">
                <h3>{collection.name}</h3>
                <p>{collection.description || collection.abstract || 'No description available.'}</p>
                <div className="collection-meta">
                  <span>Items: {collection.items?.length || 0}</span>
                  <span>ID: {collection.uuid}</span>
                </div>
                <div className="collection-actions">
                  <button className="button small">Edit</button>
                  <button className="button small">View Items</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  const renderItemsView = () => {
    // Extract all items from all collections
    const collections = deposit?.metadata?.collections || [];
    const items = collections.flatMap(collection => collection.items || []);
    
    return (
      <div className="items-view">
        <h2>Items</h2>
        
        {items.length === 0 ? (
          <div className="empty-state">
            <p>No items have been created yet.</p>
            <button className="button">Create New Item</button>
          </div>
        ) : (
          <div className="items-list">
            {items.map(item => (
              <div key={item.uuid} className="item-card">
                <h3>{item.title || item.catalog_number || `Item ${item.uuid}`}</h3>
                <p>{item.description || 'No description available.'}</p>
                <div className="item-meta">
                  <span>Files: {item.files?.length || 0}</span>
                  <span>ID: {item.uuid}</span>
                </div>
                <div className="item-actions">
                  <button className="button small">Edit</button>
                  <button className="button small">View Files</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // Determine which view to render based on type
  const renderContent = () => {
    switch(type) {
      case 'files':
        return renderFilesView();
      case 'metadata':
        return renderMetadataView();
      case 'collections':
        return renderCollectionsView();
      case 'items':
        return renderItemsView();
      default:
        return <div>Select an item from the navigation tree</div>;
    }
  };
  
  return (
    <div className="content-view">
      {renderContent()}
    </div>
  );
};

export default ContentView; 