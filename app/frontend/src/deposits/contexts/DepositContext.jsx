import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import axios from 'axios';

const DepositContext = createContext();

export const useDeposit = () => useContext(DepositContext);

export const DepositProvider = ({ children, depositId }) => {
  const [deposit, setDeposit] = useState(null);
  const [files, setFiles] = useState([]);
  const [collections, setCollections] = useState([]);
  const [unassociatedFiles, setUnassociatedFiles] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch deposit data
  useEffect(() => {
    if (!depositId) return;

    const fetchDeposit = async () => {
      try {
        setLoading(true);
        const response = await api.getDeposit(depositId);
        setDeposit(response.data);
        
        // Extract collections from metadata
        if (response.data.metadata?.data?.collections) {
          setCollections(response.data.metadata.data.collections);
        }
        
        // Extract versions
        if (response.data.metadata?.versions) {
          setVersions(response.data.metadata.versions);
          setCurrentVersion(0); // Latest version
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load deposit');
        setLoading(false);
        console.error(err);
      }
    };

    fetchDeposit();
  }, [depositId]);

  // Fetch files
  useEffect(() => {
    if (!depositId) return;

    const fetchFiles = async () => {
      try {
        const response = await api.getFiles(depositId);
        setFiles(response.data.results);
        
        // Determine unassociated files
        const associatedFilenames = new Set();
        collections.forEach(collection => {
          collection.items?.forEach(item => {
            item.files?.forEach(file => {
              associatedFilenames.add(file.filename);
            });
          });
        });
        
        const unassociated = response.data.results.filter(
          file => !file.is_metadata_file && !associatedFilenames.has(file.filename)
        );
        
        setUnassociatedFiles(unassociated);
      } catch (err) {
        console.error('Failed to load files:', err);
      }
    };

    fetchFiles();
  }, [depositId, collections]);

  // Select an item for viewing/editing
  const selectItem = (item) => {
    setSelectedItem(item);
  };

  // View a specific version
  const viewVersion = (versionIndex) => {
    if (versionIndex >= 0 && versionIndex < versions.length) {
      setCurrentVersion(versionIndex);
    }
  };

  // Function to prepare for editing by creating a draft version if needed
  const prepareForEditing = async () => {
    // Check if there's already a draft version
    const hasDraftVersion = deposit.metadata?.versions?.some(v => v.is_draft === true);
    
    if (!hasDraftVersion && deposit.state !== 'DRAFT') {
      try {
        // Clone the metadata
        const metadata = {...deposit.metadata};
        
        // Get the latest version or create initial data
        let latestVersion;
        let versionNumber = 1;
        
        if (metadata.versions && metadata.versions.length > 0) {
          latestVersion = metadata.versions[0];
          versionNumber = latestVersion.version + 1;
        } else {
          latestVersion = { data: {} };
        }
        
        // Create a new draft version
        const newVersion = {
          version: versionNumber,
          state: deposit.state,
          timestamp: new Date().toISOString(),
          modified_by: deposit.draft_user?.username || 'user',
          is_draft: true,
          comment: 'User initiated changes',
          data: JSON.parse(JSON.stringify(latestVersion.data || {}))
        };
        
        // Add to versions list (at the beginning)
        metadata.versions.unshift(newVersion);
        
        // Update the deposit with the modified metadata
        const response = await axios.patch(`/api/v1/deposits/${depositId}/`, {
          metadata: metadata
        });
        
        setDeposit(response.data);
        return true;
      } catch (error) {
        console.error('Error creating draft version:', error);
        return false;
      }
    }
    
    // Already has a draft or is in DRAFT state
    return true;
  };

  // Function to update metadata (will be called after prepareForEditing)
  const updateMetadata = async (updatedData, path) => {
    try {
      // First ensure we have a draft version
      const readyForEdit = await prepareForEditing();
      if (!readyForEdit) {
        throw new Error('Failed to prepare for editing');
      }
      
      // Clone the metadata
      const metadata = {...deposit.metadata};
      
      // Find the draft version (should be the first one)
      const draftVersion = metadata.versions.find(v => v.is_draft === true);
      
      if (!draftVersion) {
        throw new Error('No draft version found');
      }
      
      // Update the specified path in the data
      // This uses a helper function to update nested properties
      const updatedMetadata = updateNestedProperty(metadata, ['versions', 0, 'data', ...path], updatedData);
      
      // Send the update to the API
      const response = await axios.patch(`/api/v1/deposits/${depositId}/`, {
        metadata: updatedMetadata
      });
      
      setDeposit(response.data);
      return true;
    } catch (error) {
      console.error('Error updating metadata:', error);
      return false;
    }
  };
  
  // Helper function to update a nested property in an object
  const updateNestedProperty = (obj, path, value) => {
    // Clone the object to avoid mutations
    const result = {...obj};
    
    // Navigate to the nested property
    let current = result;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined) {
        current[key] = typeof path[i + 1] === 'number' ? [] : {};
      }
      current = current[key];
    }
    
    // Set the value
    current[path[path.length - 1]] = value;
    
    return result;
  };

  // Associate a file with an item
  const associateFile = async (fileId, itemUuid) => {
    try {
      await api.associateFile(fileId, itemUuid);
      
      // Refresh files to update associations
      const response = await api.getFiles(depositId);
      setFiles(response.data.results);
      
      // Recalculate unassociated files
      const associatedFilenames = new Set();
      collections.forEach(collection => {
        collection.items?.forEach(item => {
          item.files?.forEach(file => {
            associatedFilenames.add(file.filename);
          });
        });
      });
      
      const unassociated = response.data.results.filter(
        file => !file.is_metadata_file && !associatedFilenames.has(file.filename)
      );
      
      setUnassociatedFiles(unassociated);
      return true;
    } catch (err) {
      console.error('Failed to associate file:', err);
      return false;
    }
  };

  // Mark a file as metadata
  const markAsMetadata = async (fileId) => {
    try {
      await api.markAsMetadata(fileId);
      
      // Refresh files
      const response = await api.getFiles(depositId);
      setFiles(response.data.results);
      
      // Refresh deposit to get updated metadata
      const depositResponse = await api.getDeposit(depositId);
      setDeposit(depositResponse.data);
      
      // Extract collections from metadata
      if (depositResponse.data.metadata?.data?.collections) {
        setCollections(depositResponse.data.metadata.data.collections);
      }
      
      return true;
    } catch (err) {
      console.error('Failed to mark file as metadata:', err);
      return false;
    }
  };

  // Upload a file
  const uploadFile = async (file, onProgress) => {
    try {
      console.log("Starting file upload:", file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Log the CSRF token
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
      console.log("CSRF Token:", csrfToken ? "Present" : "Missing");
      
      // Make the request
      const response = await api.uploadFile(depositId, formData, {
        onUploadProgress: onProgress
      });
      
      console.log("Upload response:", response);
      
      // Refresh files
      const updatedResponse = await api.getFiles(depositId);
      setFiles(updatedResponse.data.results);
      
      // Recalculate unassociated files
      const associatedFilenames = new Set();
      collections.forEach(collection => {
        collection.items?.forEach(item => {
          item.files?.forEach(file => {
            associatedFilenames.add(file.filename);
          });
        });
      });
      
      const unassociated = updatedResponse.data.results.filter(
        file => !file.is_metadata_file && !associatedFilenames.has(file.filename)
      );
      
      setUnassociatedFiles(unassociated);
      return true;
    } catch (err) {
      console.error('Failed to upload file:', err);
      console.error('Error details:', err.response?.data || err.message);
      return false;
    }
  };

  // Transition deposit state
  const transitionState = async (newState, comment) => {
    try {
      const response = await api.transitionState(depositId, newState, comment);
      setDeposit(response.data);
      return true;
    } catch (err) {
      console.error('Failed to transition state:', err);
      return false;
    }
  };

  const value = {
    deposit,
    files,
    collections,
    unassociatedFiles,
    selectedItem,
    versions,
    currentVersion,
    loading,
    error,
    depositId,
    selectItem,
    viewVersion,
    updateMetadata,
    associateFile,
    markAsMetadata,
    uploadFile,
    transitionState,
    prepareForEditing
  };

  return (
    <DepositContext.Provider value={value}>
      {children}
    </DepositContext.Provider>
  );
}; 