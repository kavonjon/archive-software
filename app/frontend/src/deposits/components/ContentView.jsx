import React, { useState } from 'react';
import FileList from './FileList';
import MetadataEditor from './MetadataEditor';
import './ContentView.css';
import CollaboratorsTable from './CollaboratorsTable';
import { useDeposit } from '../contexts/DepositContext';

const ContentView = ({ type, selectedItem }) => {
  const { deposit, loading, error } = useDeposit();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  if (!deposit) {
    return <div className="empty-message">No deposit data available</div>;
  }
  
  const renderFilesView = () => {
    console.log("Rendering files view with selectedItem:", selectedItem);
    return <FileList selectedItem={selectedItem} />;
  };
  
  const renderMetadataView = () => {
    return <MetadataEditor item={selectedItem} />;
  };
  
  const renderCollectionsView = () => {
    return (
      <div className="collections-view">
        <h2>Collections</h2>
        <p>Manage collections in this deposit:</p>
        
        {/* Collections management UI would go here */}
        <div className="collections-list">
          <p>Collections management interface coming soon...</p>
        </div>
      </div>
    );
  };
  
  const renderCollaboratorsView = () => {
    return (
      <div className="collaborators-view">
        <h2>Collaborators</h2>
        <CollaboratorsTable />
      </div>
    );
  };
  
  // Render the appropriate view based on the type
  switch (type) {
    case 'files':
      return renderFilesView();
    case 'metadata':
      return renderMetadataView();
    case 'collections':
      return renderCollectionsView();
    case 'collaborators':
      return renderCollaboratorsView();
    default:
      return renderFilesView();
  }
};

export default ContentView; 