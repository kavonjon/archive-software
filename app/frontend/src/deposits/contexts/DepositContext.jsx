import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// Create context
const DepositContext = createContext();

// Custom hook for using the context
export const useDeposit = () => useContext(DepositContext);

export const DepositProvider = ({ children, depositId }) => {
  // State management
  const [deposit, setDeposit] = useState(null);
  const [files, setFiles] = useState([]);
  const [collections, setCollections] = useState([]);
  const [unassociatedFiles, setUnassociatedFiles] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  
  // Use a ref to track if initial data has been loaded
  const dataLoaded = useRef(false);

  // Fetch deposit data
  const fetchDeposit = useCallback(async () => {
    if (!depositId) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/v1/deposits/${depositId}/`);
      console.log("Deposit data from API:", response.data);
      
      // Parse metadata if it's a string
      let metadata = response.data.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
          console.log("Parsed metadata:", metadata);
        } catch (parseError) {
          console.error("Error parsing metadata:", parseError);
          metadata = {};
        }
      }
      
      // Update the deposit with parsed metadata
      const depositData = {
        ...response.data,
        metadata: metadata || {}
      };
      
      setDeposit(depositData);
      
      // Extract collections from metadata
      if (metadata?.versions?.[0]?.data?.collections) {
        setCollections(metadata.versions[0].data.collections);
      }
      
      // Extract unassociated files
      if (metadata?.versions?.[0]?.data?.unassociated_files) {
        setUnassociatedFiles(metadata.versions[0].data.unassociated_files);
      }
      
      // Extract versions
      if (metadata?.versions) {
        setVersions(metadata.versions);
        
        // Find the current version (first non-draft or first version)
        const nonDraftVersion = metadata.versions.findIndex(v => !v.is_draft);
        setCurrentVersion(nonDraftVersion >= 0 ? nonDraftVersion : 0);
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch deposit:', err);
      setError('Failed to load deposit data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [depositId]);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    if (!depositId) return;
    
    try {
      const response = await axios.get(`/api/v1/deposits/${depositId}/files/`);
      console.log('Files API response:', response.data);
      console.log('Files API response type:', typeof response.data);
      console.log('Is array?', Array.isArray(response.data));
      
      // Handle different response formats
      if (Array.isArray(response.data)) {
        setFiles(response.data);
      } else if (response.data && typeof response.data === 'object') {
        // Check if it has a results property (common in paginated APIs)
        if (Array.isArray(response.data.results)) {
          setFiles(response.data.results);
        } else {
          // If it's an object but not what we expect, set empty array
          console.warn('Unexpected API response format for files:', response.data);
          setFiles([]);
        }
      } else {
        // Fallback to empty array
        console.warn('Unexpected API response format for files:', response.data);
        setFiles([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load files. Please try again later.');
      // Ensure files is always an array even on error
      setFiles([]);
    }
  }, [depositId]);

  // Load data when depositId changes or on initial mount
  useEffect(() => {
    if (depositId && !dataLoaded.current) {
      fetchDeposit();
      fetchFiles();
      dataLoaded.current = true;
    }
  }, [depositId, fetchDeposit, fetchFiles]);

  // Provide a manual refresh method that can be called when needed
  const refreshData = useCallback(() => {
    dataLoaded.current = false; // Reset the flag to allow fetching again
    fetchDeposit();
    fetchFiles();
  }, [fetchDeposit, fetchFiles]);

  // Upload file
  const uploadFile = async (file, onProgress) => {
    try {
      setIsUploading(true);
      console.log("Starting file upload:", file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Get CSRF token
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
      console.log("CSRF Token:", csrfToken ? "Present" : "Missing");
      
      // Track upload progress
      const config = {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: percentCompleted
          }));
          
          if (onProgress) {
            onProgress(percentCompleted);
          }
        },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      };
      
      // Make the request
      const response = await axios.post(
        `/api/v1/deposits/${depositId}/files/upload/`, 
        formData, 
        config
      );
      
      console.log("Upload response:", response);
      
      // Refresh files
      await fetchFiles();
      
      // Clear progress for this file
      setUploadProgress(prev => {
        const newProgress = {...prev};
        delete newProgress[file.name];
        return newProgress;
      });
      
      setIsUploading(false);
      return true;
    } catch (err) {
      console.error('Failed to upload file:', err);
      console.error('Error details:', err.response?.data || err.message);
      
      // Clear progress for this file
      setUploadProgress(prev => {
        const newProgress = {...prev};
        delete newProgress[file.name];
        return newProgress;
      });
      
      setIsUploading(false);
      return false;
    }
  };

  // Associate file with item
  const associateFile = async (fileId, itemUuid) => {
    try {
      const response = await axios.post(`/api/v1/files/${fileId}/associate/`, {
        item_uuid: itemUuid
      });
      
      // Refresh files after association
      await fetchFiles();
      
      // Refresh deposit to get updated metadata
      await fetchDeposit();
      
      return true;
    } catch (err) {
      console.error('Failed to associate file:', err);
      return false;
    }
  };

  // Mark file as metadata
  const markAsMetadata = async (fileId) => {
    try {
      const response = await axios.post(`/api/v1/files/${fileId}/mark_as_metadata/`);
      
      // Refresh files
      await fetchFiles();
      
      // Refresh deposit to get updated metadata
      await fetchDeposit();
      
      return true;
    } catch (err) {
      console.error('Failed to mark file as metadata:', err);
      return false;
    }
  };

  // Transition deposit state
  const transitionState = async (newState, comment) => {
    try {
      const response = await axios.post(`/api/v1/deposits/${depositId}/transition/`, {
        state: newState,
        comment: comment
      });
      
      // Update deposit with new state
      setDeposit(response.data);
      
      // Refresh to get updated metadata
      await fetchDeposit();
      
      return true;
    } catch (err) {
      console.error('Failed to transition state:', err);
      return false;
    }
  };

  // Update metadata
  const updateMetadata = async (path, value) => {
    try {
      // Create a deep copy of the deposit
      const depositCopy = JSON.parse(JSON.stringify(deposit));
      
      // Get the latest version
      const latestVersion = depositCopy.metadata.versions[0];
      
      // Update the value at the specified path
      // This is a simplified approach - you might need a more robust solution
      // for deeply nested paths
      const pathParts = path.split('.');
      let current = latestVersion.data;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }
      
      current[pathParts[pathParts.length - 1]] = value;
      
      // Mark as draft if not already
      latestVersion.is_draft = true;
      
      // Update timestamp
      latestVersion.timestamp = new Date().toISOString();
      
      // Save the updated metadata
      const response = await axios.patch(`/api/v1/deposits/${depositId}/`, {
        metadata: depositCopy.metadata
      });
      
      // Update local state
      setDeposit(response.data);
      
      // Refresh to ensure we have the latest data
      await fetchDeposit();
      
      return true;
    } catch (err) {
      console.error('Failed to update metadata:', err);
      return false;
    }
  };

  // Discard draft changes
  const discardDraft = async () => {
    try {
      // Find the draft version in the metadata
      const metadata = {...deposit.metadata};
      const draftVersionIndex = metadata.versions.findIndex(v => v.is_draft === true);
      
      if (draftVersionIndex !== -1) {
        // Remove the draft version
        metadata.versions.splice(draftVersionIndex, 1);
        
        // Update the deposit with the modified metadata
        const response = await axios.patch(`/api/v1/deposits/${depositId}/`, {
          metadata: metadata
        });
        
        // Update local state
        setDeposit(response.data);
        
        // Refresh to ensure we have the latest data
        await fetchDeposit();
        
        return true;
      } else {
        // No draft version found
        return false;
      }
    } catch (err) {
      console.error('Failed to discard draft:', err);
      return false;
    }
  };

  // Update metadata for a specific node type
  const updateNodeMetadata = async (nodeType, nodeId, metadata) => {
    try {
      const endpoint = `/api/deposits/${depositId}/${nodeType}s/${nodeId}/`;
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
        },
        body: JSON.stringify(metadata),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update ${nodeType} metadata`);
      }
      
      // Refresh data after update
      await fetchDeposit();
      
      return true;
    } catch (error) {
      console.error(`Error updating ${nodeType} metadata:`, error);
      return false;
    }
  };

  // Context value
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
    uploadProgress,
    isUploading,
    
    // Actions
    setSelectedItem,
    uploadFile,
    associateFile,
    markAsMetadata,
    transitionState,
    updateMetadata,
    discardDraft,
    refreshData,
    updateNodeMetadata,
  };

  return (
    <DepositContext.Provider value={value}>
      {children}
    </DepositContext.Provider>
  );
}; 