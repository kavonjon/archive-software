import React, { useState, useEffect } from 'react';
import { useDeposit } from '../contexts/DepositContext';
import './MetadataEditor.css';

const MetadataEditor = ({ item }) => {
  const { updateMetadata, associateFile, loading } = useDeposit();
  const [formData, setFormData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form data based on item type
  useEffect(() => {
    if (!item) return;
    
    let initialData = {};
    
    switch (item.type) {
      case 'collection':
        initialData = {
          name: item.name || '',
          collection_abbr: item.collection_abbr || '',
          description: item.description || ''
        };
        break;
      case 'item':
        initialData = {
          catalog_number: item.catalog_number || '',
          title: item.title || '',
          description: item.description || '',
          languoid: item.languoid || '',
          date_recorded: item.date_recorded || '',
          contributors: item.contributors || []
        };
        break;
      case 'file':
      case 'unassociated-file':
        initialData = {
          filename: item.filename || '',
          description: item.description || '',
          file_type: item.file_type || '',
          mime_type: item.mime_type || ''
        };
        break;
      default:
        break;
    }
    
    setFormData(initialData);
  }, [item]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      // Different save logic based on item type
      let success = false;
      
      switch (item.type) {
        case 'collection':
        case 'item':
          success = await updateMetadata(formData);
          break;
        case 'unassociated-file':
          // For unassociated files, we might want to associate them with an item
          if (formData.associate_with_item) {
            success = await associateFile(item.id, formData.associate_with_item);
          } else {
            // Just update file metadata
            success = await updateMetadata(formData);
          }
          break;
        default:
          success = await updateMetadata(formData);
      }
      
      if (success) {
        setIsEditing(false);
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError('An error occurred while saving');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="metadata-editor">
      {error && <div className="error-message">{error}</div>}
      
      <div className="editor-actions">
        {!isEditing ? (
          <button 
            className="edit-button" 
            onClick={() => setIsEditing(true)}
          >
            Edit Metadata
          </button>
        ) : (
          <>
            <button 
              className="save-button" 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              className="cancel-button" 
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
          </>
        )}
      </div>
      
      <div className={`metadata-form ${isEditing ? 'editing' : ''}`}>
        {item.type === 'collection' && (
          <>
            <div className="form-group">
              <label>Collection Name</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              ) : (
                <div className="field-value">{formData.name || 'Not specified'}</div>
              )}
            </div>
            
            <div className="form-group">
              <label>Collection Abbreviation</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="collection_abbr" 
                  value={formData.collection_abbr || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              ) : (
                <div className="field-value">{formData.collection_abbr || 'Not specified'}</div>
              )}
            </div>
            
            <div className="form-group">
              <label>Description</label>
              {isEditing ? (
                <textarea 
                  name="description" 
                  value={formData.description || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  rows={5}
                />
              ) : (
                <div className="field-value description">{formData.description || 'No description provided'}</div>
              )}
            </div>
          </>
        )}
        
        {item.type === 'item' && (
          <>
            <div className="form-group">
              <label>Catalog Number</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="catalog_number" 
                  value={formData.catalog_number || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              ) : (
                <div className="field-value">{formData.catalog_number || 'Not specified'}</div>
              )}
            </div>
            
            <div className="form-group">
              <label>Title</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              ) : (
                <div className="field-value">{formData.title || 'Not specified'}</div>
              )}
            </div>
            
            <div className="form-group">
              <label>Language</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="languoid" 
                  value={formData.languoid || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              ) : (
                <div className="field-value">{formData.languoid || 'Not specified'}</div>
              )}
            </div>
            
            <div className="form-group">
              <label>Date Recorded</label>
              {isEditing ? (
                <input 
                  type="date" 
                  name="date_recorded" 
                  value={formData.date_recorded || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              ) : (
                <div className="field-value">{formData.date_recorded || 'Not specified'}</div>
              )}
            </div>
            
            <div className="form-group">
              <label>Description</label>
              {isEditing ? (
                <textarea 
                  name="description" 
                  value={formData.description || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  rows={5}
                />
              ) : (
                <div className="field-value description">{formData.description || 'No description provided'}</div>
              )}
            </div>
          </>
        )}
        
        {(item.type === 'file' || item.type === 'unassociated-file') && (
          <>
            <div className="form-group">
              <label>Filename</label>
              <div className="field-value">{formData.filename || 'Not specified'}</div>
            </div>
            
            <div className="form-group">
              <label>File Type</label>
              <div className="field-value">{formData.file_type || 'Unknown'}</div>
            </div>
            
            <div className="form-group">
              <label>MIME Type</label>
              <div className="field-value">{formData.mime_type || 'Unknown'}</div>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              {isEditing ? (
                <textarea 
                  name="description" 
                  value={formData.description || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  rows={5}
                />
              ) : (
                <div className="field-value description">{formData.description || 'No description provided'}</div>
              )}
            </div>
            
            {item.type === 'unassociated-file' && isEditing && (
              <div className="form-group">
                <label>Associate with Item (UUID)</label>
                <input 
                  type="text" 
                  name="associate_with_item" 
                  value={formData.associate_with_item || ''} 
                  onChange={handleInputChange}
                  placeholder="Enter item UUID to associate this file"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MetadataEditor; 