import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DepositProvider, useDeposit } from '../contexts/DepositContext';
import NavigationTree from './NavigationTree';
import ContentView from './ContentView';
import VersionHistory from './VersionHistory';
import '../styles/index.css';

// Inner component that uses the context
const DepositContent = () => {
  const { 
    deposit, 
    loading, 
    error, 
    discardDraft 
  } = useDeposit();
  
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('files');
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Function to handle discarding draft changes
  const handleDiscardDraft = () => {
    if (window.confirm("Are you sure you want to discard all draft changes? This cannot be undone.")) {
      setDiscardingDraft(true);
      
      discardDraft()
        .then(success => {
          setDiscardingDraft(false);
          if (success) {
            alert("Draft changes have been discarded.");
          } else {
            alert("No draft changes found to discard.");
          }
        })
        .catch(error => {
          setDiscardingDraft(false);
          alert("Failed to discard draft changes: " + error.message);
        });
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
              onClick={() => navigate(`/deposits/${deposit.id}/submit`)}
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
                onClick={() => navigate(`/deposits/${deposit.id}/approve`)}
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
                onClick={() => navigate(`/deposits/${deposit.id}/revision`)}
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
                onClick={() => navigate(`/deposits/${deposit.id}/reject`)}
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
          <NavigationTree onSelectItem={setSelectedItem} />
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
            <ContentView type={activeView} selectedItem={selectedItem} />
          </div>
        </div>
        
        <div className="right-pane" style={{ width: '300px', borderLeft: '1px solid #ccc', overflowY: 'auto' }}>
          <VersionHistory />
        </div>
      </div>
    </div>
  );
};

// Wrapper component that provides the context
const DepositLayout = () => {
  const { depositId } = useParams();
  
  return (
    <DepositProvider depositId={depositId}>
      <DepositContent />
    </DepositProvider>
  );
};

export default DepositLayout; 