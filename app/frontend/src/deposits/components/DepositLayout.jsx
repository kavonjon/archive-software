import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DepositProvider } from '../contexts/DepositContext';
import NavigationTree from './NavigationTree';
import ContentView from './ContentView';
import VersionHistory from './VersionHistory';
import FileList from './FileList';
import CollaboratorsTable from './CollaboratorsTable';
import './DepositLayout.css';

const DepositLayout = () => {
  const { depositId } = useParams();
  const navigate = useNavigate();
  
  const [deposit, setDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('files'); // 'files', 'metadata', 'collections', 'collaborators'
  const [discardingDraft, setDiscardingDraft] = useState(false);

  useEffect(() => {
    const fetchDeposit = async () => {
      try {
        const response = await axios.get(`/api/v1/deposits/${depositId}/`);
        console.log("Deposit data from API:", response.data);
        console.log("Metadata type:", typeof response.data.metadata);
        console.log("Metadata content:", response.data.metadata);
        
        // If metadata is a string, parse it
        if (typeof response.data.metadata === 'string') {
          try {
            response.data.metadata = JSON.parse(response.data.metadata);
            console.log("Parsed metadata:", response.data.metadata);
          } catch (parseError) {
            console.error("Error parsing metadata:", parseError);
          }
        }
        
        setDeposit(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching deposit:', err);
        setError('Failed to load deposit: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    if (depositId) {
      fetchDeposit();
    }
  }, [depositId]);

  // Function to handle discarding draft changes
  const handleDiscardDraft = () => {
    if (window.confirm("Are you sure you want to discard all draft changes? This cannot be undone.")) {
      setDiscardingDraft(true);
      
      // Find the draft version in the metadata
      const metadata = {...deposit.metadata};
      const draftVersionIndex = metadata.versions.findIndex(v => v.is_draft === true);
      
      if (draftVersionIndex !== -1) {
        // Remove the draft version
        metadata.versions.splice(draftVersionIndex, 1);
        
        // Update the deposit with the modified metadata
        axios.patch(`/api/v1/deposits/${depositId}/`, {
          metadata: metadata
        })
        .then(response => {
          setDeposit(response.data);
          setDiscardingDraft(false);
          alert("Draft changes have been discarded.");
        })
        .catch(error => {
          console.error("Error discarding draft:", error);
          setDiscardingDraft(false);
          alert("Failed to discard draft changes: " + (error.response?.data?.error || error.message));
        });
      } else {
        // If no draft version was found
        setDiscardingDraft(false);
        alert("No draft changes found to discard.");
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading deposit...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!deposit) {
    return <div className="not-found">Deposit not found</div>;
  }

  // Check if the deposit has a draft version
  const hasDraftVersion = deposit.metadata?.versions?.some(v => v.is_draft === true);

  const getStatusColor = (state) => {
    switch (state.toUpperCase()) {
      case 'DRAFT': return '#6c757d';
      case 'REVIEW': return '#ffc107';
      case 'NEEDS_REVISION': return '#fd7e14';
      case 'ACCEPTED': return '#28a745';
      case 'REJECTED': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <DepositProvider depositId={depositId}>
      <div className="deposit-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div className="deposit-layout-header" style={{ padding: '15px', borderBottom: '1px solid #ccc' }}>
          <div className="title-status-container" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h1 style={{ margin: 0 }}>{deposit.title || `Deposit #${deposit.id}`}</h1>
            <div className="deposit-status" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span 
                className={`status-badge status-${deposit.state.toLowerCase()}`}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  backgroundColor: getStatusColor(deposit.state)
                }}
              >
                {deposit.state}
              </span>
              {hasDraftVersion && (
                <span 
                  className="draft-indicator"
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'white',
                    backgroundColor: '#17a2b8'
                  }}
                >
                  DRAFT CHANGES
                </span>
              )}
            </div>
          </div>
          
          <div className="deposit-actions" style={{ display: 'flex', gap: '10px' }}>
            {deposit.state === 'DRAFT' && (
              <button 
                className="action-button submit-button" 
                onClick={() => navigate(`/deposits/${depositId}/submit`)}
                style={{
                  padding: '8px 16px',
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content'
                }}
              >
                Submit for Review
              </button>
            )}
            {hasDraftVersion && (
              <button 
                className="action-button discard-button" 
                onClick={handleDiscardDraft}
                disabled={discardingDraft}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  marginRight: '10px',
                  padding: '8px 16px',
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content'
                }}
              >
                {discardingDraft ? 'Discarding...' : 'Discard Draft Changes'}
              </button>
            )}
            {deposit.state === 'REVIEW' && deposit.is_reviewer && (
              <>
                <button 
                  className="action-button approve-button" 
                  onClick={() => navigate(`/deposits/${depositId}/approve`)}
                  style={{
                    padding: '8px 16px',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  Approve
                </button>
                <button 
                  className="action-button revision-button" 
                  onClick={() => navigate(`/deposits/${depositId}/revision`)}
                  style={{
                    padding: '8px 16px',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  Request Revision
                </button>
                <button 
                  className="action-button reject-button" 
                  onClick={() => navigate(`/deposits/${depositId}/reject`)}
                  style={{
                    padding: '8px 16px',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content'
                  }}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="three-pane-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div className="left-pane" style={{ width: '250px', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
            <NavigationTree depositId={depositId} />
          </div>
          
          <div className="center-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="view-tabs" style={{ borderBottom: '1px solid #ccc' }}>
              <ul style={{ display: 'flex', listStyle: 'none', margin: 0, padding: 0 }}>
                <li 
                  className={activeView === 'files' ? 'active' : ''} 
                  onClick={() => setActiveView('files')}
                  style={{ 
                    padding: '12px 20px', 
                    cursor: 'pointer', 
                    borderBottom: activeView === 'files' ? '3px solid #007bff' : '3px solid transparent',
                    fontWeight: activeView === 'files' ? '500' : 'normal'
                  }}
                >
                  Files
                </li>
                <li 
                  className={activeView === 'metadata' ? 'active' : ''} 
                  onClick={() => setActiveView('metadata')}
                  style={{ 
                    padding: '12px 20px', 
                    cursor: 'pointer', 
                    borderBottom: activeView === 'metadata' ? '3px solid #007bff' : '3px solid transparent',
                    fontWeight: activeView === 'metadata' ? '500' : 'normal'
                  }}
                >
                  Metadata
                </li>
                <li 
                  className={activeView === 'collections' ? 'active' : ''} 
                  onClick={() => setActiveView('collections')}
                  style={{ 
                    padding: '12px 20px', 
                    cursor: 'pointer', 
                    borderBottom: activeView === 'collections' ? '3px solid #007bff' : '3px solid transparent',
                    fontWeight: activeView === 'collections' ? '500' : 'normal'
                  }}
                >
                  Collections
                </li>
                <li 
                  className={activeView === 'collaborators' ? 'active' : ''} 
                  onClick={() => setActiveView('collaborators')}
                  style={{ 
                    padding: '12px 20px', 
                    cursor: 'pointer', 
                    borderBottom: activeView === 'collaborators' ? '3px solid #007bff' : '3px solid transparent',
                    fontWeight: activeView === 'collaborators' ? '500' : 'normal'
                  }}
                >
                  Collaborators
                </li>
              </ul>
            </div>
            
            <div className="view-content" style={{ flex: 1, overflow: 'auto' }}>
              <ContentView type={activeView} depositId={depositId} deposit={deposit} />
            </div>
          </div>
          
          <div className="right-pane" style={{ width: '300px', borderLeft: '1px solid #ccc', overflowY: 'auto' }}>
            <VersionHistory depositId={depositId} />
          </div>
        </div>
      </div>
    </DepositProvider>
  );
};

export default DepositLayout; 